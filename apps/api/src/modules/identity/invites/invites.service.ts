import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { MemberRole, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

/** Invite lifetime: 7 days from creation. */
export const INVITE_TTL_DAYS = 7;

const SYSTEM_ROLE_NAMES = ["OWNER", "ADMIN", "LEAD", "MEMBER", "VIEWER"] as const;

export interface CreateInviteInput {
  email: string;
  roleId: string;
}

/**
 * Member invites — invite first, account later.
 *
 * An invite creates NO user account: the invitee only becomes a
 * member when they accept (POST /members/invites/:token/accept),
 * which is when the Membership row is created. Until then the invite
 * is just a row with a random token.
 *
 * Token delivery: there is NO email sender yet, so the create
 * response returns the token in dev — the inviter hands the accept
 * link to the invitee out of band. In production the token goes out
 * by email (SES) and is NEVER returned by the API. The list endpoint
 * never includes tokens.
 *
 * Every mutation is tenant-scoped (a role / membership / invite from
 * another workspace is never visible or mutable here) and audit-logged.
 */
@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvite(tenantId: string, invitedById: string, input: CreateInviteInput) {
    const email = input.email.trim().toLowerCase();
    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, tenantId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const membership = await this.prisma.membership.findFirst({
        where: { tenantId, userId: existingUser.id },
        select: { id: true },
      });
      if (membership) {
        throw new ConflictException(`${email} is already a member of this workspace`);
      }
    }

    const now = new Date();
    const duplicate = await this.prisma.invite.findFirst({
      where: { tenantId, email, status: "PENDING", expiresAt: { gt: now } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `${email} already has a pending invite in this workspace — revoke it before inviting again`,
      );
    }

    const invite = await this.prisma.invite.create({
      data: {
        tenantId,
        email,
        roleId: role.id,
        invitedById,
        token: randomBytes(32).toString("hex"),
        status: "PENDING",
        expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      include: {
        role: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.audit(tenantId, invitedById, "invite.created", invite.id, {
      email,
      roleId: role.id,
      roleName: role.name,
    });
    return invite;
  }

  /**
   * Pending invites for the tenant, newest first. Tokens are NOT
   * included — the list is for managing invites, not for accepting
   * them. Expired-but-still-PENDING rows are included with their
   * expiresAt so the UI can show them as expired.
   */
  async listInvites(tenantId: string) {
    const invites = await this.prisma.invite.findMany({
      where: { tenantId, status: "PENDING" },
      include: {
        role: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return invites.map(({ token: _token, ...rest }) => rest);
  }

  /**
   * Accept an invite. The caller is authenticated (dev-login user
   * id); the invite's own tenantId is authoritative — accepting is
   * how a user JOINS a workspace, so the JWT tenant need not match.
   * Creates the User row if it does not exist yet (from the invite
   * email), then creates/updates the Membership with the invited
   * role, and marks the invite ACCEPTED. Expired invites are marked
   * EXPIRED and rejected with 410.
   */
  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status !== "PENDING") {
      throw new ConflictException(`Invite has already been ${invite.status.toLowerCase()}`);
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      await this.audit(invite.tenantId, userId, "invite.expired", invite.id, {
        email: invite.email,
      });
      throw new GoneException("Invite has expired — ask a workspace admin to invite you again");
    }

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: invite.email } });
    }
    if (!user) {
      const name = invite.email.split("@")[0] ?? "New member";
      user = await this.prisma.user.create({
        data: { id: userId, email: invite.email, name },
      });
    }

    // Legacy MemberRole enum mirrors the invited system role when the
    // role is a system role; otherwise MEMBER (the guard resolves
    // from roleId, the enum is only a fallback — see schema comment).
    const legacyRole = (
      SYSTEM_ROLE_NAMES as readonly string[]
    ).includes(invite.role.name)
      ? (invite.role.name as MemberRole)
      : ("MEMBER" as MemberRole);
    const membership = await this.prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
      update: { roleId: invite.roleId, role: legacyRole },
      create: {
        tenantId: invite.tenantId,
        userId: user.id,
        role: legacyRole,
        roleId: invite.roleId,
      },
      include: { roleRef: { select: { id: true, name: true } } },
    });
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    await this.audit(invite.tenantId, user.id, "invite.accepted", invite.id, {
      email: invite.email,
      roleId: invite.roleId,
      roleName: invite.role.name,
    });
    return { membership, inviteId: invite.id, tenantId: invite.tenantId };
  }

  /** Revoke a pending invite. Accepted / expired / revoked invites cannot be revoked again. */
  async revokeInvite(tenantId: string, userId: string, id: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true, status: true },
    });
    if (!invite) throw new NotFoundException("Invite not found in this workspace");
    if (invite.status !== "PENDING") {
      throw new ConflictException(`Cannot revoke an invite that is ${invite.status.toLowerCase()}`);
    }
    await this.prisma.invite.update({ where: { id }, data: { status: "REVOKED" } });
    await this.audit(tenantId, userId, "invite.revoked", id, { email: invite.email });
    return { id, revoked: true };
  }

  private audit(
    tenantId: string,
    userId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity: "Invite",
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
