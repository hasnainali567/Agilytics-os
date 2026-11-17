# --- ECS Fargate (API) ---
resource "aws_ecs_cluster" "main" {
  name = "agilytics-${var.environment}"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "agilytics-${var.environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([
    {
      name  = "api"
      image = "TODO: ECR image URI (pushed by GitHub Actions)"
      portMappings = [{ containerPort = 3001 }]
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "API_PORT", value = "3001" },
      ]
      secrets = [
        # DATABASE_URL and JWT_SECRET come from Secrets Manager — never env vars in TF.
        { name = "DATABASE_URL", valueFrom = "TODO: secretsmanager ARN" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
    },
  ])
}

resource "aws_ecs_service" "api" {
  name            = "agilytics-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }
}

resource "aws_lb_target_group" "api" {
  port        = 3001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id
  health_check {
    path = "/api/v1/health"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/agilytics-${var.environment}-api"
  retention_in_days = 30
}

# Least-privilege IAM: execution role (pull image, write logs) and task role
# (read secrets, S3, SQS). No wildcard permissions.
resource "aws_iam_role" "ecs_execution" {
  name               = "agilytics-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "ecs_task" {
  name               = "agilytics-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}
