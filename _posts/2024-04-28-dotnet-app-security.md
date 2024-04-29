---
title: "Why .NET apps can be dangerous"
date: 2024-04-28 12:00:00 -0500
categories: [software, stories]
tags: [application security, .NET, dnSpy]
---

If you know anything about C#/.NET, it's that anyone can easily decompile and pick apart at your assemblies. And I'm talkin' using easy to find tools like [dnSpyEx](https://github.com/dnSpyEx) that decompile your binaries straight back to C#.
What does this mean for software developers? Well, say your company develops an in-house, crucial software stack that will be outsourced to 3rd party contractors. It's also built with Unity. 
Nothing wrong with Unity, it's capable. The issue lies when there are no integrity checks, [tamper protection](https://learn.microsoft.com/en-us/dotnet/framework/app-domains/gac), [DLL hijack mitigation](https://support.microsoft.com/en-us/topic/secure-loading-of-libraries-to-prevent-dll-preloading-attacks-d41303ec-0748-9211-f317-2edc819682e1), [code obfuscation](https://docs.unity3d.com/Manual/IL2CPP.html), etc. These are obviously not surefire ways to secure your application, but security is layers, and the more layers you have, the more deterrent your assemblies are to the curious.

# "Why bother?"

It's all up to risk assessment. If your WPF app is only going to serve as a simple front-end for users to edit their Minecraft save file and you're not worried about the source code, then why bother?

What if your software operates through a company-issued VPN requiring MFA, then giving access to crucial, client assets? There was no trust in place for the software integrity, builds were distributed via email and circulated by low-tier employees through OneDrive links. It would be easy enough to craft a malicious DLL to hook onto the application process, zip it in an existing build, and pose as a dev pushing out the newest, coolest update. You already gave the code in the DLL free VPN access, it's just a matter of what you want to do while you're inside the gates. 

So that's exactly what happened.  

# MelonLoader in the workplace

[MelonLoader](https://github.com/LavaGang/MelonLoader) is well known by the gaming community to add mod support to almost any Unity game. MelonLoader utilizes DLL proxying to serve a legitimate DLL to Unity, but also registering hooks to load custom code, or mods, inside the app process. Within a "mod", you can utilize .NET reflection to access private/protected members and classes, hook onto the app/game functions to intercept their calls at runtime, and much more.

Seeing that I was able to view the classes and their methods freely within dnSpy, I took to setting up a Melon mod. My DLL would expose the internal methods to an IPC pipe which allowed external applications to control the app. 
