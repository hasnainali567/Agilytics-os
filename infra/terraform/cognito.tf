# SKELETON — not yet applied. See main.tf for the resources.
#
# Cognito user pool: one pool, custom attribute `custom:tenant_id`,
# MFA enforced for platform admins. The API verifies JWTs against this
# pool's JWKS endpoint (see apps/api/README.md).
#
# resource "aws_cognito_user_pool" "main" {
#   name = "agilytics-${var.environment}"
#   schema {
#     name                = "tenant_id"
#     attribute_data_type = "String"
#     mutable             = false
#   }
#   mfa_configuration = "OPTIONAL" # TODO: "ON" for platform admins via a group
#   password_policy {
#     minimum_length    = 12
#     require_lowercase = true
#     require_numbers   = true
#     require_symbols   = true
#     require_uppercase = true
#   }
# }
#
# resource "aws_cognito_user_pool_client" "web" {
#   name         = "agilytics-web"
#   user_pool_id = aws_cognito_user_pool.main.id
# }
