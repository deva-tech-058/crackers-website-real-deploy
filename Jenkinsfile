pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  parameters {
    string(name: 'BACKEND_HOST', defaultValue: 'ec2-user@api.example.com', description: 'Backend EC2 SSH target')
    string(name: 'FRONTEND_HOST', defaultValue: 'ec2-user@www.example.com', description: 'Frontend EC2 SSH target')
    string(name: 'BACKEND_APP_DIR', defaultValue: '/var/www/crackers-backend', description: 'Backend app directory on EC2')
    string(name: 'FRONTEND_APP_DIR', defaultValue: '/var/www/crackers-frontend', description: 'Frontend directory on EC2')
    string(name: 'PM2_APP_NAME', defaultValue: 'crackers-api', description: 'PM2 app name')
    string(name: 'API_BASE_URL', defaultValue: 'https://api.example.com', description: 'Frontend runtime API base URL')
    string(name: 'ASSET_BASE_URL', defaultValue: 'https://api.example.com', description: 'Frontend runtime asset base URL')
    string(name: 'FRONTEND_BASE_URL', defaultValue: 'https://www.example.com', description: 'Frontend runtime frontend URL')
  }

  environment {
    SSH_CREDENTIALS_ID = 'aws-ec2-ssh'
    BACKEND_RELEASE = 'backend-release.tar.gz'
    FRONTEND_RELEASE = 'frontend-release.tar.gz'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install and Validate') {
      steps {
        sh 'npm ci'
        sh 'node --check src/app.js'
        sh 'node --check src/server.js'
        sh 'node --check public/js/api-client.js'
      }
    }

    stage('Build Frontend Runtime Config') {
      steps {
        sh '''
          chmod +x deploy/scripts/render-runtime-config.sh
          API_BASE_URL="${API_BASE_URL}" \
          ASSET_BASE_URL="${ASSET_BASE_URL}" \
          FRONTEND_BASE_URL="${FRONTEND_BASE_URL}" \
          ./deploy/scripts/render-runtime-config.sh
        '''
      }
    }

    stage('Package Artifacts') {
      steps {
        sh '''
          tar -czf "${BACKEND_RELEASE}" \
            package.json package-lock.json \
            src server.js ecosystem.config.js .env.example deploy/scripts/remote-deploy-backend.sh

          tar -czf "${FRONTEND_RELEASE}" \
            public deploy/scripts/remote-deploy-frontend.sh
        '''
      }
    }

    stage('Deploy Backend EC2') {
      steps {
        sshagent(credentials: [env.SSH_CREDENTIALS_ID]) {
          sh '''
            scp -o StrictHostKeyChecking=no "${BACKEND_RELEASE}" "${BACKEND_HOST}:/tmp/${BACKEND_RELEASE}"
            ssh -o StrictHostKeyChecking=no "${BACKEND_HOST}" "
              mkdir -p ${BACKEND_APP_DIR}
              tar -xzf /tmp/${BACKEND_RELEASE} -C ${BACKEND_APP_DIR}
              cd ${BACKEND_APP_DIR}
              chmod +x deploy/scripts/remote-deploy-backend.sh
              ./deploy/scripts/remote-deploy-backend.sh ${BACKEND_APP_DIR} ${PM2_APP_NAME}
            "
          '''
        }
      }
    }

    stage('Deploy Frontend EC2') {
      steps {
        sshagent(credentials: [env.SSH_CREDENTIALS_ID]) {
          sh '''
            scp -o StrictHostKeyChecking=no "${FRONTEND_RELEASE}" "${FRONTEND_HOST}:/tmp/${FRONTEND_RELEASE}"
            ssh -o StrictHostKeyChecking=no "${FRONTEND_HOST}" "
              mkdir -p ${FRONTEND_APP_DIR}
              rm -rf ${FRONTEND_APP_DIR}/public
              tar -xzf /tmp/${FRONTEND_RELEASE} -C ${FRONTEND_APP_DIR}
              cd ${FRONTEND_APP_DIR}
              chmod +x deploy/scripts/remote-deploy-frontend.sh
              ./deploy/scripts/remote-deploy-frontend.sh ${FRONTEND_APP_DIR}
            "
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '*.tar.gz', allowEmptyArchive: true
      cleanWs()
    }
  }
}
