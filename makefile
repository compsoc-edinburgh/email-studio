
# pull in from dotenv
include .env
export

DOCKER_TAG_NAME = compsoc-sso-demo-js
REMOTE = compsoc-admin@bucket.comp-soc.com
REMOTE_DESTINATION = sso-js
STAGING = staging


all: run

run:
	node server.js

watch:
	npx nodemon server.js

init:
	npm install

clean:
	rm -rf ${STAGING}

init-db:
	cat schema.sql | sqlite3 ${DATABASE}

build:
	docker build . -t ${DOCKER_TAG_NAME}

run-docker: build
	docker-compose up

export: clean build
	mkdir -p ${STAGING}
	docker save ${DOCKER_TAG_NAME} -o ${STAGING}/${DOCKER_TAG_NAME}.tar
	gzip ${STAGING}/${DOCKER_TAG_NAME}.tar

deploy: upload
	ssh -t ${REMOTE} 'cd ${REMOTE_DESTINATION}; sudo docker-compose stop; sudo docker load -i ${DOCKER_TAG_NAME}.tar; sudo docker-compose up -d;'


init-deploy:
	ssh -t ${REMOTE} 'mkdir -p ${REMOTE_DESTINATION}'
	scp docker-compose.yml ${REMOTE}:${REMOTE_DESTINATION}
	-scp -r instance ${REMOTE}:${REMOTE_DESTINATION}
	-scp .env ${REMOTE}:${REMOTE_DESTINATION}

upload: export
	rsync -avz --progress ${STAGING}/${DOCKER_TAG_NAME}.tar.gz ${REMOTE}:${REMOTE_DESTINATION}/${DOCKER_TAG_NAME}.tar.gz
	ssh -t ${REMOTE} 'gzip -df ${REMOTE_DESTINATION}/${DOCKER_TAG_NAME}.tar.gz'

upload-reg: build
	docker push ${DOCKER_TAG_NAME}

deploy-reg: upload-reg
	ssh -t ${REMOTE} 'cd ${REMOTE_DESTINATION}; sudo docker-compose stop; sudo docker pull ${DOCKER_TAG_NAME}; sudo docker-compose up -d;'

connect:
	ssh ${REMOTE}

