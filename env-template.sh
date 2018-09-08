#
# === template for setting environment variables for offlineweb. Copy to .env
#     and modify there.
#

# = these variables are used in beluga configuration, not in the container

# extend dnsmasq to answer the docker host IP for any query. This is not typically
# changed during configuration, but should be left at this value. 
DNSMASQ_EXTRA="--address=/#/${IP_ADDR}"

# offlineweb will handle http instead of nginx-proxy. This is a required parameter which
# should not be changed.
WEBHANDLER=offlineweb

# = end of beluga configuration variables

# The following directories are defined on the docker host system, and are used to
# create Docker volumes that map to the appropriate locations in offlineweb

# location of the certificate authority certificate files ca.key and ca.crt. The default
# uses the public values from the test directory, so if this is left blank or the directory
# is empty, those valaues are used. It is strongly recommended that you
# create your own values, and point here to the directory containing those.
OFFLINEWEB_CERTIFICATEPATH=~/offlineweb/certificates

# location of the log files. If blank, the volume is not created and the files are only
# accessible on the container.
OFFLINEWEB_LOGPATH=~/offlineweb/log

# location of the response directory containing cached web content and generated certificates
# If blank, the volume is not created and the files are only
# accessible on the container.
OFFLINEWEB_CACHEPATH=~/offlineweb/cache

# Port used for http connections.
OFFLINEWEB_PORT=3129

# Port used for https connections.
OFFLINEWEB_TLSPORT=3130

# web timeout in milliseconds
OFFLINEWEB_WEBTIMEOUT=5000
