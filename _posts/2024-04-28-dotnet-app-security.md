---
title: "Why .NET apps can be dangerous"
date: 2024-04-28 12:00:00 -0500
categories: [software, stories]
tags: [application security, .NET, dnSpy]
---

If you know anything about C#/.NET, it's that anyone can easily decompile and pick apart at your assemblies. And I'm talkin' using easy to find tools like [dnSpyEx](https://github.com/dnSpyEx) that decompile your binaries straight back to C#.
What does this mean for software developers? Well, say your company develops an in-house, crucial software stack that will be outsourced to 3rd party contractors. It's also built with Unity. 
Nothing wrong with Unity, it's capable. The issue lies when there are no integrity checks, [tamper protection](https://learn.microsoft.com/en-us/dotnet/framework/app-domains/gac), [DLL hijack mitigation](https://support.microsoft.com/en-us/topic/secure-loading-of-libraries-to-prevent-dll-preloading-attacks-d41303ec-0748-9211-f317-2edc819682e1), [code obfuscation](https://docs.unity3d.com/Manual/IL2CPP.html), etc. These are obviously not surefire ways to secure your application, but security is layers, and the more layers you have, the more deterrent your software is to the curious.

# "Why bother?"

It's all up to risk assessment. If your WPF app is only going to serve as a simple front-end for users to edit their Minecraft save file and you're not worried about the source code, then why bother?

Well, paint this picture in your head: What if your software operates through a company-issued VPN requiring MFA, then giving access to crucial, client assets? There's no trust in place for the software integrity, builds were distributed via email and circulated by low-tier employees through Google Drive links. It would be easy enough to craft a malicious DLL to hook onto the application process, zip it in an existing build, and pose as a dev pushing out the newest, coolest update. You already gave the code in the DLL free passage through the tunnel, it's just a matter of what you want to do while you're inside the gates. 

So that's exactly what happened.  

# MelonLoader in the Workplace

[MelonLoader](https://github.com/LavaGang/MelonLoader) is well known by the gaming community to add mod support to almost any Unity game. MelonLoader utilizes DLL proxying to serve a legitimate DLL to Unity, but also registering hooks to load custom code, or mods, inside the app process. Within a "mod", you can utilize .NET reflection to access private/protected members and classes, hook onto the app/game functions to intercept their calls at runtime, and much more. Full code execution, no suspicious processes, no process migration needed. In the end, our client was informed of our concerns and life continued on I guess.

# "What's the worst that could happen?"

Let's say you start a software company with the goal of creating a product for users to manage their media and plan scripts for organizations. You charge licenses for your software, after all, a company is fueled on money. Joe Shmo comes in, sees the price of a license, doesn't quite like your numbers, and goes away to find an open-source alternative.

So that's kinda what happened, just with a different ending.

# Bypassing License Checks with dnSpy

## Prerequisites

I'll assume you'll know basic assembly and programming concepts, such as instruction sets, how compiling works, and the C# and IL reference/instruction set. You'll need Visual Studio as well, with the .NET Development bundle. I'm not going to hold your hand.

## Overview

[dnSpyEx](https://github.com/dnSpyEx) (forked from the original [dnSpy](https://github.com/dnSpy/dnSpy)) is a GUI for .NET decompilation and recompilation. It can decompile .NET assemblies back to C# or [IL (Intermediate Language)](https://learn.microsoft.com/en-us/dotnet/standard/managed-code#intermediate-language--execution). If you have the right reference assemblies, you can recompile the C# back into its binary form. Or if you're comfortable with assembly-like IL, you don't usually have to worry about references.

## Identifying a suspect

Usually I'll throw a binary/DLL into dnSpy and see what happens. If it's a valid .NET assembly, it'll give me the resources, references, and classes in the Assembly Explorer. If not, it'll just spit out a PE header and some other PE details. At that point, put it through [Ghidra](https://ghidra-sre.org/) and start at your entry point (or exports I guess if it's a library). While it isn't the scope of this article, I'd suggest checking out [stacksmashing](https://www.youtube.com/watch?v=Sv8yu12y5zM) on YouTube for a good Ghidra run-through video.

Well if you've made it this far and have your assembly in dnSpy, it should look kinda like this:
| ![](https://docs.bepinex.dev/articles/advanced/debug/images/dnSpy_set_breakpoint.png) |
|:--:| 
| *Image Source: [BepInEx Docs](https://docs.bepinex.dev/articles/advanced/debug/plugins_dnSpy.html)* |

Hooray, you've found yourself an easy target.
