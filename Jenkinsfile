// CI del backend: pruebas, compilación, imagen Docker, integración con PostgreSQL y publicación en Docker Hub.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  environment {
    IMAGE_NAME = 'flashreto-backend'
  }
  stages {
    stage('Preparar') {
      steps {
        script {
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
          env.CI_PROJECT = "ci-${env.BUILD_TAG}".toLowerCase().replaceAll('[^a-z0-9_-]', '-')
        }
        sh 'node --version && npm --version && docker --version && docker compose version'
      }
    }
    stage('Instalar dependencias') {
      steps { sh 'npm ci --no-audit --no-fund' }
    }
    stage('Pruebas unitarias') {
      steps { sh 'npm test' }
    }
    stage('Compilar') {
      steps { sh 'npm run build' }
    }
    stage('Imagen Docker') {
      steps { sh 'docker build --tag "$IMAGE_NAME:$IMAGE_TAG" .' }
    }
    stage('Integración con Docker Compose') {
      steps {
        sh '''
          set -eu
          node -e 'const c=require("node:crypto");process.stdout.write("POSTGRES_PASSWORD="+c.randomBytes(32).toString("hex")+"\\nPOSTGRES_PORT=0\\nBACKEND_PORT=0\\n")' > .env.ci
          docker compose --project-name "$CI_PROJECT" --env-file .env.ci up --build --detach --wait --wait-timeout 180
          docker network connect "${CI_PROJECT}_default" "$JENKINS_CONTAINER"
          FLASHRETO_URL=http://backend:4000 npm run test:integration
        '''
      }
      post {
        always {
          sh '''
            docker network disconnect "${CI_PROJECT}_default" "$JENKINS_CONTAINER" 2>/dev/null || true
            docker compose --project-name "$CI_PROJECT" --env-file .env.ci down --volumes --remove-orphans || true
            rm -f .env.ci
          '''
        }
      }
    }
    stage('Publicar en Docker Hub') {
      when {
        anyOf {
          branch 'main'
          changeRequest target: 'main'
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          sh '''
            set -eu
            if [ -z "$DOCKERHUB_USER" ] || [ -z "$DOCKERHUB_TOKEN" ]; then
              echo "Sin credenciales de Docker Hub: se omite la publicación."
              exit 0
            fi
            repository="$DOCKERHUB_USER/$IMAGE_NAME"
            if [ -n "${CHANGE_ID:-}" ]; then channel="pr-$CHANGE_ID"; else channel=latest; fi
            echo "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USER" --password-stdin
            for tag in "$IMAGE_TAG" "$channel"; do
              docker tag "$IMAGE_NAME:$IMAGE_TAG" "$repository:$tag"
              docker push "$repository:$tag"
            done
            docker logout
          '''
        }
      }
    }
  }
  post {
    always { cleanWs() }
  }
}
