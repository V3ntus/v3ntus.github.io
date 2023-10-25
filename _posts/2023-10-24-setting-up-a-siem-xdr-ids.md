---
title: "Blue team operations for the masses"
date: 2023-10-24 12:00:00 -0500
categories: [SIEM, XDR, IDS, IPS, Wazuh, CrowdSec, Wireguard]
tags: [homelab, security, networking]
---

Now that I have a homelab server I'd like to expose to the internet somewhat, I would like to ensure my network is secure. I started exploring security solutions such as SIEM's, IDS/IPS's, and XDR's. I also explored managing a VPN with Wireguard which is what I'll get into right now. A VPN would let me access my home LAN from abroad but allows controlled and isolated access between peers.

# Wireguard
Originally, I had an OpenVPN server instance running on my VPS. This worked great for years, but was often difficult to maintain. Today, I looked into Wireguard and was thorougly impressed with their claims and reviews from other users.

## Setting up LAN access from Wireguard
Although not behind a CG-NAT, my home's CPE (fancy acronym for cable modem?) would not allow me to port forward or anything of the sorts. I settled on hosting a Wireguard instance on my VPS, having my router peer to the VPS, and route packets destined to my home LAN to the router's Wireguard IP.

[PiVPN](https://www.pivpn.io/) is a neat, automated solution for setting up a VPN server on any Linux server, not limited to Raspberry Pi's. Setting up the Wireguard instance was super easy with this script. After generating some configs for a couple of my devices, I could tunnel with each and communicate with each other.
```sh
ventus@vps:~$ pivpn -l
::: Clients Summary :::
Client       Public key  Creation date
phone       ...          24 Oct 2023, 15:47, UTC
router      ...          25 Oct 2023, 01:55, UTC
::: Disabled clients :::
```
Now, I needed to setup routing to tell my VPS to forward packets destined to my home LAN of `192.168.2.0/24` to the `router`'s IP address. All that's needed is adding it to the `AllowedIPs` field in the Wireguard server config:
```ini
### begin router ###
[Peer]
PublicKey = ...
PresharedKey = ...
AllowedIPs = 192.168.2.0/24,10.143.245.3/32,fd11:5ee:bad:c0de::3/128
### end router ###
```
{: file='/etc/wireguard/wg0.conf'}  
After that, I reloaded the configuration with `wg-quick down wg0` and `wg-quick up wg0`. A new IPv4 route was added to the route table and I was able to communicate with my LAN from my phone on LTE.

# Wazuh SIEM
I settled on checking out the open-source SIEM Wazuh. It looked perfect for the hobbyist homelab enthusiast. Considering it's based on the ELK stack, it's also easy to install if using their installation assistant script. After getting the indexer, server, and dashboard setup on a Debian VM on my Proxmox instance, I created an agent instance on the Proxmox host itself as well as on my VPS. I figured those two were good starting endpoints to monitor.  
![Wazuh agents](/assets/img/Screenshot%202023-10-24%20225228.png)  
I was already getting security events from my VPS, so that confirmed Wazuh was up and working.

There's quite a bit to Wazuh and SIEM's in general, so I'll have to dig deeper another time.

# CrowdSec
Currently, I had `fail2ban` running in the background. I set it and forgot about it, figured that would be fine. But I wanted to explore an alternative and I found [CrowdSec](https://www.crowdsec.net/), an open-source and collaborative security stack utilizing crowdsourced threat intelligence. After getting it all set up on my VPS and installing the iptables bouncer, I enrolled it in the CrowdSec Console, an online hub of sorts to view alerts, engines, decisions (bans basically), and more. Endpoint protection on my VPS was now active. Let's test it out!

## Doing a dumb thing
I decided to run a `nikto` scan from my Parrot OS Proxmox instance against my website. Now, my website is being hosted on the same server Wireguard is on. I'll let you guess what happened a few seconds after I hit `Enter` after I entered the nikto command. Yes, CrowdSec detected crawling on my website and decided to ban my home network, except since my VPS was the exit gateway for my home network, my internet at home shut down until I logged into my VPS from my phone (disconnected from Wireguard) and deleted the CrowdSec ban decision. It works!  
![Getting banned by my own IPS](/assets/img/Screenshot%202023-10-24%20231353.png)  

# Conclusion
I now have endpoint monitoring for my public-facing VPS as well as my internal Proxmox instance (which should be pretty quiet), as well as endpoint protection on my VPS. I'm more at ease with my network's security, though I have much more to explore and much more to configure. Till next time!