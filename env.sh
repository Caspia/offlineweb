# environment template for offlineweb. Append to beluga/.env and modify as appropriate.

# extend dnsmasq to answer the docker host IP for any query
DNSMASQ_EXTRA="--address=/#/${IP_ADDR}"

# offlineweb will handle http instead of nginx-proxy
WEBHANDLER="offlineweb"

# location of the certificate authority certificate
#OFFLINEWEB_CACRTPATH='test/ca.crt'

# location of the certificate authority private key
#OFFLINEWEB_CAKEYPATH='test/ca.key'

# location of the log files
#OFFLINEWEB_LOGFILESPATH='~/offlineweb/log'

# location of the response directory containing cached web content
#OFFLINEWEB_RESPONSECACHEPATH='~/offlineweb/responseDir'

# location of the locally created tls certificates for https sites
#OFFLINEWEB_CERTIFICATECACHEPATH='~/offlineweb/cacheDir'

# Port used for http connections
OFFLINEWEB_PORT=3129

# Port used for https connections
OFFLINEWEB_TLSPORT=3130
