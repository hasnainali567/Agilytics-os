import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @ApiOperation({ summary: "Health" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get()
  health() {
    return { status: "ok", service: "agilytics-os-api", version: "0.1.0" };
  }
}
