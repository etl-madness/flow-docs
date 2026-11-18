# Tutorials

note: in progress

Welcome to the tutorial for our ETL Madness flow. In this guide, we will walk you through the steps to set up and use the ETL flow effectively.

## Overview

In this tutorial, we will cover the basic steps to set up and use the ETL Madness flow, including installation, configuration, and running the flow command line interface (CLI).

## Prerequisites

Before you begin, ensure you have the following installed:

- Flow (go-flow) [https://github.com/etl-madness/go-flow](https://github.com/etl-madness/go-flow)
- Go 1.26 [https://golang.org/doc/install](https://golang.org/doc/install)

## Installation

Quick start by cloning the repository and building the Flow binary for your platform.
The following sections will guide you through building and installing Flow on different platforms.
There are multiple ways to install Flow depending on your operating system and preferences. The first set of examples will cover building and installing Flow from source, and installing locally, while the later section will cover installing using OS package formats.

### Installing Flow from Source locally

To install Flow from source locally, you need to clone the repository and build the binary for your platform. Follow the instructions for your operating system below.

#### Build and Install Flow on Linux, macOS, and FreeBSD

```bash
git clone https://github.com/etl-madness/go-flow.git
cd go-flow
go build -o flow .
sudo mv flow ~/.local/bin/flow
```

#### Build and Install Flow on Windows

```powershell
git clone https://github.com/etl-madness/go-flow.git
cd go-flow
go build -o flow.exe .
move flow.exe $env:LOCALAPPDATA\Programs\flow\flow.exe
```

### (Optional) Install using OS Package Formats

Follow the instructions in the packaging README to install Flow using your preferred OS package format.

[go-flow Packaging README](https://github.com/etl-madness/go-flow/blob/main/packaging/README.md)

### Getting Help

If you encounter any issues or have questions while using the ETL Madness flow, you can get help through the following channels:

- Check the [go-flow GitHub repository](https://github.com/etl-madness/go-flow) for issues and discussions.
- Refer to the [documentation](https://etl-madness.github.io/flow-docs/) for detailed guides and references.
- Join the community discussions or reach out to the maintainers for support.
