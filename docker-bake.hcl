variable "TAG" {
  default = "latest"
}

function "base_labels" {
  params = []
  result = {
    "org.opencontainers.image.created" = timestamp()
    "org.opencontainers.image.authors" = "kiva <kiva@kiva.lgbt>"
    "org.opencontainers.image.url" = "https://gitea.kiva.lgbt/faekiva/fastmail-archiver"
    "org.opencontainers.image.documentation" = "https://gitea.kiva.lgbt/faekiva/fastmail-archiver"
    "org.opencontainers.image.source" = "https://gitea.kiva.lgbt/faekiva/fastmail-archiver"
    "org.opencontainers.image.version" = TAG
    "org.opencontainers.image.vendor" = "kiva"
  }
}

function "labels" {
  params = [title, description]
  result = merge(base_labels(), {
    "org.opencontainers.image.title" = title
    "org.opencontainers.image.description" = description
  })
}

group "default" {
  targets = ["default"]
}

target "default" {
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64"]
  tags = [ "https://gitea.kiva.lgbt/faekiva/fastmail-archiver:latest" ]
}