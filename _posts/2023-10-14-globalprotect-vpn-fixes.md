---
title: "How I resolved a nasty corporate VPN issue"
date: 2023-10-14 12:00:00 -0500
categories: [stories]
tags: [networks, VPN, work]
---

Our client provides us with a VPN to access their internal data in order for us to deliver work. Due to a misconfiguration within the VPN portal, many crucial services were blocked with no communication from the client. In this post, I write about how I identified the issue, evaluated and distributed an internal fix, and attempted to circulate the fix upwards to our client's IT SOC team.

# The Situation

Currently, I have been working for a engineering firm subcontracted by a larger corporation. We take in their field data and deliver network infrastructure designs to our client. Now of course, this data is internal and requires us to be connected through our client's VPN, a [Palo Alto GlobalProtect](https://docs.paloaltonetworks.com/globalprotect) service.

Since I've started working at this company, issues arose where connections to services such as Microsoft Outlook, OneDrive, Github, Google Earth, and even Google Search could not complete and would timeout. Our company relies on the Microsoft Office suite in order to communicate and track data between managers and the individual departments. A few of our departments depended on Google Earth for some of their GIS functions. As these needed services were blocked while connected to our client's VPN, it became quite frustrating needing to complete operations outside the broken VPN while still requiring internal data. So, I decided to poke around to see why this was the case. Many weeks had passed and it seemed like there was nothing being done.

# Evaluating the issue
As most network troubleshooting goes, I started simple. The VPN configuarion sends internal DNS server information to clients in order for them to resolve host names pointed to internal services. I did a couple nameserver lookups to see which IP addresses were being resolved to websites such as `github.com`. Oddly enough, the internal DNS server reported strange results.
```
C:\Users\User>nslookup github.com
Server:  internal.dns.server.com
Address:  10.10.0.1

Non-authoritative answer:
Name:    github.com
Address:  10.0.0.1
```
The actual data is redacted for privacy reasons, but GitHub was being resolved to some internal IP address within the VPN, while CloudFlare's 1.1.1.1 showed the appropriate answer:
```
C:\Users\User>nslookup
Default Server:  internal.dns.server.com
Address:  10.10.0.1

> server 1.1.1.1
Default Server:  one.one.one.one
Address:  1.1.1.1

> github.com
Server:  one.one.one.one
Address:  1.1.1.1

Non-authoritative answer:
Name:    github.com
Address:  140.82.112.3
```

At the time, I thought that this was the issue and I wrote a janky solution and write-up to be distributed around the office. All people needed to do was open their `hosts` file as admin and append bindings to needed services. Now, that write-up only included a single binding that resolved an issue where we could not access a certain internal service. I had not included other `hosts` entries.

And for a while, this worked fine for that one crucial, internal service. The office was a little bit happier. We communicated the issue and write-up with our client's IT SOC team, except they couldn't replicate it. Everything else was still being improperly resolved to wrong IP addresses. This wasn't the fix.

# Undoing a small oopsie
Our coordinator sent an announcment weeks later saying client communications for our jobs would be sent to individual engineers now, which means we would need to be checking our inboxes regularly. Except we couldn't because we needed to be connected to the VPN to complete work.  
![Microsoft-Teams-Announcement](/assets/lib/Screenshot 2023-10-14 145505.png)