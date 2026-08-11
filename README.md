---
title: DefectIQ
emoji: 🏭
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 3000
---

# DefectIQ

DefectIQ is an AI-powered industrial manufacturing quality-analysis suite.

## Deployment on Hugging Face Spaces

This repository is configured to deploy directly to Hugging Face Spaces using the Docker SDK.

1. Create a new Space on [Hugging Face](https://huggingface.co/spaces)
2. Select **Docker** as the Space SDK
3. Choose **Blank** Docker template
4. Push this repository to your Space
5. Add your `GROQ_API_KEY` to the Space's **Settings > Variables and secrets > Secrets**.
