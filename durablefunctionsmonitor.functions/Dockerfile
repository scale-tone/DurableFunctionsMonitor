FROM mcr.microsoft.com/azure-functions/node:2.0

ENV AzureWebJobsScriptRoot=/home/site/wwwroot
COPY . /home/site/wwwroot

# No idea, why this line is needed and why it is still not automatically added by func init --docker.
# But without this variable function extensions do not work inside a container.
ENV WEBSITE_HOSTNAME=localhost:80