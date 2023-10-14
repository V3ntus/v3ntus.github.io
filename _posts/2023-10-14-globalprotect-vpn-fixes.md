---
title: "How I resolved a nasty corporate VPN issue"
date: 2023-10-14 12:00:00 -0500
categories: [stories]
tags: [networks, VPN, PowerShell]
---

Our client provides us with a VPN to access their internal data in order for us to deliver work. Due to a misconfiguration within the VPN portal, many crucial services were blocked with no communication from the client. In this post, I write about how I identified the issue, evaluated and distributed an internal fix, and attempted to circulate the fix upwards to our client's IT SOC team.

# The Situation

Currently, I have been working for a engineering firm subcontracted by a larger corporation. We take in their field data and deliver network infrastructure designs to our client. Now of course, this data is internal and requires us to be connected through our client's VPN, a [Palo Alto GlobalProtect](https://docs.paloaltonetworks.com/globalprotect) service.

Since I've started working at this company, issues arose where connections to services such as Microsoft Outlook, OneDrive, Github, Google Earth, and even Google Search could not complete and would timeout. Our company relies on the Microsoft Office suite in order to communicate and track data between managers and the individual departments. A few of our departments depended on Google Earth for some of their GIS functions. The software I was developing internally relied on GitHub for CI/CD artifacts delivering updates to its users. As these needed services were blocked while connected to our client's VPN, it became quite frustrating needing to complete operations outside the broken VPN while still requiring internal data. So, I decided to poke around to see why this was the case. Many weeks had passed and it seemed like there was nothing being done.

# Evaluating the issue (wrongly)
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

# Now what?
Our coordinator sent an announcment weeks later saying client communications for our jobs would be sent to individual engineers now, which means we would need to be checking our inboxes regularly. Except we couldn't because we needed to be connected to the VPN to complete work and Outlook was being killed by the VPN.  

![Microsoft-Teams-Announcement](/assets/img/Screenshot%202023-10-14%20145505.png)
__This won't work__

Now there really needs to be a better fix. If DNS wasn't the way, what else is there?

# Apple Maps but it's just our GlobalProtect VPN
```
PS C:\Users\User> Get-NetRoute

ifIndex DestinationPrefix                              NextHop                                  RouteMetric ifMetric PolicyStore
------- -----------------                              -------                                  ----------- -------- -----------
55      255.255.255.255/32                             0.0.0.0                                          256 5000     ActiveStore
47      255.255.255.255/32                             0.0.0.0                                          256 5000     ActiveStore
39      255.255.255.255/32                             0.0.0.0                                          256 5000     ActiveStore
27      255.255.255.255/32                             0.0.0.0                                          256 5000     ActiveStore
22      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
30      255.255.255.255/32                             0.0.0.0                                          256 2        ActiveStore
8       255.255.255.255/32                             0.0.0.0                                          256 1        ActiveStore
31      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
23      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
1       255.255.255.255/32                             0.0.0.0                                          256 75       ActiveStore
55      224.0.0.0/4                                    0.0.0.0                                          256 5000     ActiveStore
47      224.0.0.0/4                                    0.0.0.0                                          256 5000     ActiveStore
39      224.0.0.0/4                                    0.0.0.0                                          256 5000     ActiveStore
27      224.0.0.0/4                                    0.0.0.0                                          256 5000     ActiveStore
22      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
30      224.0.0.0/4                                    0.0.0.0                                          256 2        ActiveStore
8       224.0.0.0/4                                    0.0.0.0                                          256 1        ActiveStore
31      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
23      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
1       224.0.0.0/4                                    0.0.0.0                                          256 75       ActiveStore
[...a couple hundred more lines later with varying destination IP addresses...]
22      0.0.0.0/0                                      0.0.0.0                                      256 25       ActiveStore
```

Oh my. Quite a bit. From what I can gather, the GlobalProtect configuration is utilizing split tunnel to maybe try and only route traffic going into their internal services? I'm not sure, but nothing looked right. I did a `findstr` using the network portion of the GitHub IP and surely enough, there was a static route that was being routed to the next hop `0.0.0.0` with a metric lower than needed. The same goes for Microsoft services. And Google. 

During other unrelated tests, I had used OpenConnect instead of Palo Alto's client. OpenConnect supports GlobalProtect, but is a CLI program instead of a GUI. It would print many lines after logging in, where each line would say something like "Configuring split route tunnel for: \<IPv4 address\>". From this, I could at least deduct where all these routes came from.

While still connected to GlobalProtect, I removed the routes relevant to GitHub's IP. Access to the service was restored and I was able to load GitHub.
```ps
PS C:\Users\User> Remove-NetRoute -DestinationPrefix 140.82.112.0/24 -InterfaceIndex 22 -NextHop 0.0.0.0
PS C:\Users\User> Remove-NetRoute -DestinationPrefix 140.82.112.255/32 -InterfaceIndex 22 -NextHop 0.0.0.0
```

# The Real Solution
The issue was discovered and it did work for more than just one thing. Now, a simple way for people to utilize this fix on their own computers. Telling everyone to wipe their route tables was not going to work, tech savy or not. For one, not everyone in the office knows what a PowerShell or "route table" is. And secondly, the route table contains important routes going to the VPN and other destinations. I needed to figure out a one-click solution that would automate the safe removal of irrelevant and misconfigured routes in the route table. I decided on Powershell as it is quite versatile when one needs to interact with and automate Windows on a lower level. Here's the agenda:

- Find all routes associated to the GlobalProtect VPN interface on a user's PC
- Only remove routes that don't point to services we use
- Must be run as admin, but also one-click (\*cough\* execution policies)

# Powershell Shenanigans

### Whitelisted Hostnames
I first needed to gather a list of internal hostnames we need in order to do work. The list included the internal DNS server, a production API server for an application multiple departments use here, an internal project tracker, and multiple MongoDB instances used by the API server, just in case. This list will tell the script what routes need to be ignored.

### Detecting the GlobalProtect Interface Index
Conveniently, we only need to remove routes that are associated to a single network interface on the user's PC. In the script, I only pick an interface that matches the literal description of the GlobalProtect VPN client software creates.
```powershell
$GPIface = Get-NetAdapter -Name * | Where-Object { $_.InterfaceDescription -like "*PANGP*" }
```

### Resolving IP's to the whitelisted hostnames list
We cannot simply pass a hostname in `Remove-NetRoute`. We're gonna need to resolve the hostname first, then parse it to a proper destination prefix.
```powershell
$_IPWhitelist = @()
Write-Output "Resolving IP addresses to critical domain names..."
try {
    foreach ($domain in $_DomainWhitelist) {
        $ip = $(Resolve-DnsName -Name $domain -DnsOnly).IP4Address
        $_ip_split = $ip.split(".")
        $_IPWhitelist += $_ip_split[0], $_ip_split[1] -join "."
        Write-Output " + Resolved $domain -> $ip ($($_IPWhitelist | Select-Object -Last 1))"
    }
} catch {
    Write-Error "Could not resolve crucial services DNS, exiting"
    pause
    Exit 1
}
```
In the code snippet above, the loop iterates through each hostname in the whitelist. It will then attempt to resolve each to an IP address we can use. As these IP addresses are pointing to hosts, we need to split and parse the address to its network portion. For simplicity, I use the first two octets. These get added to an IP whitelist which we will append the appropriate prefixes later in the script.

### Separating bad and good routes
Next, we iterate through every route in the route table that is associated with the GlobalProtect interface index. If the route's destination matches an entry in the IP whitelist, we'll add it to a good routes list. Otherwise, the route object gets added to the bad routes list.
```powershell
$badRoutes = @()
$goodRoutes = @()

# Iterate through all the routes for the GlobalProtect interface
foreach ($route in $(Get-NetRoute -InterfaceIndex $($GPIface.ifIndex))) {
    foreach ($prefix in $_IPWhitelist) {
        # If route is in whitelist, add to goodRoutes and break, else add to bad routes
        if ($route.DestinationPrefix -like "${prefix}*") {
            $goodRoutes += $route
            continue
        }
        elseif ($route.DestinationPrefix -notlike "${prefix}*") {
            $badRoutes += $route
        }
    }
}
```

### Finally, removing all the bad routes
As we now have a list of bad routes that we can safely remove, we iterate through this list and call `Remove-NetRoute` for each of them.
```powershell
# Iterate through all the bad routes and remove them
$_goodRoutesPrefixes = $goodRoutes | ForEach-Object { $_.DestinationPrefix }
foreach ($badRoute in $badRoutes) {
    if ($_goodRoutesPrefixes -contains $badRoute.DestinationPrefix) {
        continue
    }
    Remove-NetRoute -InputObject $badRoute -Confirm:$false -ErrorAction SilentlyContinue
}
```

Testing this all locally, all previously interrupted services were restored while connected to the VPN, important websites were now working.

# Distributing the solution
In order for this to work universally, I wrote a simple Batch script that would temporarily unrestrict script execution policies for the Powershell script, then run it as Administrator. I bundled these two in a zip file (honestly could've base64 encoded the Powershell script in the Batch file and bundled it in one file, but it was already 1AM when I finished these scripts) and sent these out for people to test and run. In the end, coordinators were happy, engineers were happy, work could go smoother.