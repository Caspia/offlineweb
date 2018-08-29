
# === environment template for offlineweb. Append to beluga/.env and modify as appropriate. ===

# extend dnsmasq to answer the docker host IP for any query. This is not typically
# changed during configuration, but should be left at this value. 
DNSMASQ_EXTRA="--address=/#/${IP_ADDR}"

# offlineweb will handle http instead of nginx-proxy. This is a required parameter which
# should not be changed.
WEBHANDLER="offlineweb"

# location of the certificate authority certificate files ca.key and ca.crt.
OFFLINEWEB_CERTIFICATEPATH="$HOME/offlineweb"

# location of the log files
OFFLINEWEB_LOGPATH="$HOME/offlineweb/log"

# location of the response directory containing cached web content and generated certificates
OFFLINEWEB_CACHEPATH="$HOME/offlineweb/cache"

# Port used for http connections
OFFLINEWEB_PORT=3129

# Port used for https connections
OFFLINEWEB_TLSPORT=3130
