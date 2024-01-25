---
title: "Reverse engineering the Atomos Ninja V"
date: 2024-01-24 12:00:00 -0500
categories: [hardware hacking]
tags: [security, hardware, hacking, reverse engineering]
---

[In a recent post](https://v3ntus.github.io/posts/sony-shoot/), I got myself an Atomos Ninja V and brought it on a Sony film set to shoot some BTS. For context, the [Atomos Ninja V](https://web.archive.org/web/20231130120253/https://www.atomos.com/products/ninja-v) (now archived) is a powerful monitor and recorder for videographers that is capable of recording ProRes 4k RAW video and more.

Obviously, the hardware here is pretty powerful, but it's marketed for videographers. Let's hack it instead.

# Extracting the Firmware  
First thing, we need an image of whatever's running on the device. Some might dump the firmware from a EEPROM chip or NAND. Some might just look to see if the manufacturer supplies firmware update images. So let's do that. At the time of this post, yes, Ninja V firmware updates are available to download.

## Obtaining a firmware image online
![AtomosFirmware](/assets/img/atomos/1.jpg)

EZ. Time to unzip.

```
ventus@Ventus-PC:~/atomos$ ls
ATOMNJV.FW  AtomOS_10.94.01_NINJAV_Release_Notes.html  __MACOSX
```

## Taking a peek inside
After the unzip, we have a supposed firmware file, release notes, and oddly a `__MACOSX` Mac OS resource fork. The firmware file is the most appealing to me right now so let's figure out how to peek inside it.

```
ventus@Ventus-PC:~/atomos$ file ATOMNJV.FW
ATOMNJV.FW: TIM image, Pixel at (7,0) Size=1052x0
```

Useless (maybe). How about `binwalk`?

```
ventus@Ventus-PC:~/atomos$ binwalk ATOMNJV.FW

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
2144          0x860           gzip compressed data, from Unix, last modified: 1970-01-01 00:00:00 (null date)
126286871     0x786FC17       COBALT boot rom data (Flat boot rom or file system)
177635818     0xA9681EA       MySQL ISAM index file Version 7
234434301     0xDF92EFD       Nagra Constant_KEY IDEA_Key: 10192431 38B6EFF1 E25FCAC3
242241596     0xE70503C       Flattened device tree, size: 46572 bytes, version: 17
243242660     0xE7F96A4       CRC32 polynomial table, little endian
243257864     0xE7FD208       Android bootimg, kernel size: 1920091392 bytes, kernel addr: 0x203A726F, ramdisk size: 1635151433 bytes, ramdisk addr: 0x2064696C, product name: ""
243317793     0xE80BC21       LZO compressed data
```

That's a lot to process. I would imagine most of these are false positives, but the first entry does look interesting. It's `gzip` data and occupies a large portion of the file from `0x860` to `0x786FC17`. We can verify that by `hexdump`ing the `head` of a file. Take a look at `0x860`.
```diff
ventus@Ventus-PC:~/atomos$ head ATOMNJV.FW | hexdump
0000000 0010 0000 6677 6173 0000 0100 0007 0000
...
+ 0000860 8b1f 0008 0000 0000 0300 d7ec b055 3790
```
On page 5 of the [GZIP RFC](https://www.rfc-editor.org/rfc/rfc1952), we see the specifications for member headers and trailers. ID1 and 2 are fixed values `0x1f` and `0x8b` and we can see that in the first 16 bits. The next 16 bits indicate the compression method (`0x08` equating to `deflate`) and the flag byte (`0x00` which should be `FTEXT` but is probably not important here). Let's put these fixed bytes in another `binwalk` but using the raw sequence of bytes flag.

```
ventus@Ventus-PC:~/atomos$ binwalk -R "\x1f\x8b\x08" ATOMNJV.FW

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
2144          0x860           Raw signature (\x1f\x8b\x08)
10462627      0x9FA5A3        Raw signature (\x1f\x8b\x08)
10474717      0x9FD4DD        Raw signature (\x1f\x8b\x08)
43784774      0x29C1A46       Raw signature (\x1f\x8b\x08)
48312778      0x2E131CA       Raw signature (\x1f\x8b\x08)
105409576     0x6486C28       Raw signature (\x1f\x8b\x08)
114979265     0x6DA71C1       Raw signature (\x1f\x8b\x08)
116786438     0x6F60506       Raw signature (\x1f\x8b\x08)
143345707     0x88B482B       Raw signature (\x1f\x8b\x08)
149922241     0x8EFA1C1       Raw signature (\x1f\x8b\x08)
151433372     0x906B09C       Raw signature (\x1f\x8b\x08)
159904359     0x987F267       Raw signature (\x1f\x8b\x08)
161603434     0x9A1DF6A       Raw signature (\x1f\x8b\x08)
174798694     0xA6B3766       Raw signature (\x1f\x8b\x08)
177702294     0xA978596       Raw signature (\x1f\x8b\x08)
185128728     0xB08D718       Raw signature (\x1f\x8b\x08)
189434130     0xB4A8912       Raw signature (\x1f\x8b\x08)
195538682     0xBA7AEFA       Raw signature (\x1f\x8b\x08)
206417564     0xC4DAE9C       Raw signature (\x1f\x8b\x08)
230582094     0xDBE674E       Raw signature (\x1f\x8b\x08)
241333466     0xE6274DA       Raw signature (\x1f\x8b\x08)
254533971     0xF2BE153       Raw signature (\x1f\x8b\x08)
```

Ah, now that's a lot more results. The last found signature starts at `0xF2BE153` where the original scan stopped at `0x786FC17`. `stat` gives us a file size of `267652476` or `0xFF40D7C`. We *might* be able to assume (and most likely overshoot) that the last gzip member runs to the end of the file and still extract enough. Instead of using `binwalk` to extract, we'll just use `dd` to copy the bytes with an offset.

```
ventus@Ventus-PC:~/atomos$ dd if=ATOMNJV.FW bs=8 skip=268 of=fw.gz status=progress
261849384 bytes (262 MB, 250 MiB) copied, 43 s, 6.1 MB/s
33456291+1 records in
33456291+1 records out
267650332 bytes (268 MB, 255 MiB) copied, 43.9279 s, 6.1 MB/s
```

```
ventus@Ventus-PC:~/atomos$ gunzip fw.gz

gzip: fw.gz: decompression OK, trailing garbage ignored
```
```
ventus@Ventus-PC:~/atomos$ file fw
fw: DOS/MBR boot sector, code offset 0x3c+2, OEM-ID "mkfs.fat", sectors/cluster 128, reserved sectors 128, root entries 2048, Media descriptor 0xf8, sectors/FAT 128, sectors/track 63, heads 16, sectors 539091 (volumes > 32 MB), serial number 0xca18f21f, unlabeled, FAT (16 bit)
```

Sweet! Let's `binwalk` and get an overview.
## Walking the binary

```
ventus@Ventus-PC:~/atomos$ binwalk fw

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
7911788       0x78B96C        CRC32 polynomial table, little endian
7991728       0x79F1B0        Copyright string: "Copyright (c) 1996-2008 Express Logic Inc. * ThreadX ARM9/RVDS Version G5.1.5.1 SN: 2923-115-1301 *"
113705113     0x6C70099       Xilinx Virtex/Spartan FPGA bitstream dummy + sync word
114499764     0x6D320B4       Intel x86 or x64 microcode, sig 0x020000c0, pf_mask 0x12000000, 2000-02-08, rev 0x2000000, size 2048
115001340     0x6DAC7FC       LZMA compressed data, properties: 0x88, dictionary size: 1073741824 bytes, uncompressed size: 256 bytes
115164534     0x6DD4576       Intel x86 or x64 microcode, sig 0x21890000, pf_mask 0x90200001, 2000-04-10, rev 0x-7fac0000, size 2048
115228793     0x6DE4079       LZMA compressed data, properties: 0x88, dictionary size: 0 bytes, uncompressed size: 136 bytes
115263529     0x6DEC829       Intel x86 or x64 microcode, sig 0x20000000, pf_mask 0x00, 2000-04-04, size 2048
115397674     0x6E0D42A       LZMA compressed data, properties: 0xC0, dictionary size: 0 bytes, uncompressed size: 1024 bytes
115933353     0x6E900A9       Xilinx Virtex/Spartan FPGA bitstream dummy + sync word
116302255     0x6EEA1AF       LZMA compressed data, properties: 0x90, dictionary size: 536870912 bytes, uncompressed size: 32 bytes
116385130     0x6EFE56A       Intel x86 or x64 microcode, sig 0x00048080, pf_mask 0x18080, 2008-01-31, rev 0x21200400, size 16777216
135790593     0x8180001       Copyright string: "Copyright (C) 2018  Intel Corporation. All rights reserved."
135791457     0x8180361       Unix path: /home/luke/projects/phoenix_scratch/fpga/syn/expansion/exp_common/output_files/exp_common.pof Sat Apr 25 10:32:03 2020
140640257     0x8620001       Copyright string: "Copyright (C) 2018  Intel Corporation. All rights reserved."
140641121     0x8620361       Unix path: /home/luke/projects/phoenix_scratch/fpga/syn/expansion/exp_common/output_files/exp_common.pof Tue Apr 28 18:50:25 2020
144375808     0x89B0000       Flattened device tree, size: 7708440 bytes, version: 17
144376028     0x89B00DC       gzip compressed data, maximum compression, from Unix, last modified: 1970-01-01 00:00:00 (null date)
152035648     0x90FE140       Flattened device tree, size: 47248 bytes, version: 17
152174592     0x9120000       Flattened device tree, size: 43507384 bytes, version: 17
152174812     0x91200DC       gzip compressed data, maximum compression, from Unix, last modified: 1970-01-01 00:00:00 (null date)
159834432     0x986E140       Flattened device tree, size: 47248 bytes, version: 17
159881880     0x9879A98       gzip compressed data, maximum compression, from Unix, last modified: 1970-01-01 00:00:00 (null date)
188629687     0xB3E42B7       SHA256 hash constants, little endian
195690496     0xBAA0000       gzip compressed data, maximum compression, from Unix, last modified: 1970-01-01 00:00:00 (null date)
200262789     0xBEFC485       Zlib compressed data, compressed
```

That's quite a bit, but the data is much more promissing. FPGA bit streams, Intel microcode, more gzip data, LZMA data, Zlib data... mmm delicious.

> [!NOTE]  
> [Atomos has confirmed](https://www.redsharknews.com/technology-computing/item/74-fpgas-the-processing-powerhouse-behind-todays-video-technology) that the Ninja series utilizes FPGA technology for accelerated hardware processing. This backs the results `binwalk` gave us stating the firmware contains FPGA bitstreams. This'll be interesting to disect later as I'll probably disassemble the device to identify the FPGA model.

At this point, I found the [`radare2`](https://github.com/radareorg/radare2/) reverse engineering framework and figured it would be a good time to learn. So I took a little break from this and went off to read the [Radare book](https://book.rada.re/first_steps/intro.html).

I did run strings on the extracted `fw` file and found interesting entries in the MBR section of the file. The last line in this snippet hints at a UBOOT environment. If we find UART or JTAG, we could interrupt the bootloader and get a pre-boot environment shell.
```
ventus@Ventus-PC:~/atomos$ strings -10 fw | head -n 100
NO NAME    FAT16
This is not a bootable disk.  Please insert a bootable floppy and
press any key to try again ...
                !       "       #       $       %       &       '       (       )       *       +       ,       -       .       /       0       1       2       3       4       5       6       7       8       ~
                !       "       #       $       %       &       '       (       )       *       +       ,       -       .       /       0       1       2       3       4       5       6       7       8       ~
BOOTE~1JBE
APP0000 BIN
DAPP0000BIN
DATA0000BIN
DOCKUSB BIN
DPGA0000BIN
DPGA0001BIN
DPGA0002BIN
DPGA0003BIN
DPGA0005BIN
DPGA0006BIN
DPGA0009BIN
DPGA0012BIN
DPGA0013BIN
DPGA0014BIN
DPGA0015BIN
DPGA0017BIN
DPGA0018BIN
FMODDOCKBIN
FMODSTRMBIN
FWFAILEDBIN
MANIFESTXMD
PLS_WAITBIN
RES0001 BIN
SYNC0001BIN
SYNC0002BIN
SYNC0003BIN
SYNC0004BIN
SYNC0005BIN
XMODDOCKBIN
XMODSDI BIN
XMODSTRMBIN
XMODSYN BIN
FLASH   UB
GECKO_FWBIN
RAMDISK UB
ROOTFS  BIN
ROOTFS  TXT
UBOOT   ENV
...
```