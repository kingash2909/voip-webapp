#!/bin/bash

# Coturn Installation Script for Ubuntu 22.04+ (VPS)
# This script should be run on your VPS as root or with sudo.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Coturn installation...${NC}"

# Check if running on Ubuntu/Debian
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        echo -e "${RED}Warning: This script is tested on Ubuntu/Debian. Your OS ($ID) might not be supported.${NC}"
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${RED}Error: Cannot determine OS. This script requires a Linux distribution with /etc/os-release.${NC}"
    exit 1
fi

# 1. Update and Install
echo -e "${GREEN}Updating packages and installing Coturn...${NC}"
sudo apt-get update
sudo apt-get install coturn -y

# 2. Get Public IP
echo -e "${GREEN}Detecting public IP...${NC}"
DETECTED_IP=$(curl -s https://ifconfig.me)
read -p "Enter your VPS public IP (Default: $DETECTED_IP): " VPS_IP
VPS_IP=${VPS_IP:-$DETECTED_IP}

# 3. Configure Coturn
echo -e "${GREEN}Configuring Coturn...${NC}"
cat <<EOF | sudo tee /etc/turnserver.conf
# Coturn Configuration for VoIP MVP
listening-port=3478
tls-listening-port=5349

# Use long-term credential mechanism
lt-cred-mech
fingerprint

# Credentials
user=ashish:mishra_secret_password
realm=voip.local
server-name=coturn_server

# Networking
external-ip=$VPS_IP

# Log file
log-file=/var/log/turn.log
verbose

# Security
no-stdout-log
EOF

# 4. Enable Coturn to start as a daemon
echo -e "${GREEN}Enabling Coturn daemon...${NC}"
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn || echo "TURNSERVER_ENABLED=1" | sudo tee -a /etc/default/coturn

# 5. Open Firewall Ports (assuming UFW)
if command -v ufw > /dev/null; then
    echo -e "${GREEN}Configuring UFW firewall...${NC}"
    sudo ufw allow 3478/tcp
    sudo ufw allow 3478/udp
    sudo ufw allow 5349/tcp
    sudo ufw allow 5349/udp
    sudo ufw allow 49152:65535/udp
else
    echo -e "${RED}UFW not found. Please ensure ports 3478 (TCP/UDP), 5349 (TCP/UDP), and 49152-65535 (UDP) are open in your firewall.${NC}"
fi

# 6. Restart Coturn
echo -e "${GREEN}Restarting Coturn...${NC}"
sudo systemctl restart coturn
sudo systemctl status coturn

echo -e "${GREEN}Coturn installation and configuration complete!${NC}"
echo -e "STUN URI: stun:$VPS_IP:3478"
echo -e "TURN URI: turn:$VPS_IP:3478 (User: ashish, Pass: mishra_secret_password)"
