FROM python:3.12-slim

WORKDIR /docs

COPY mkdocs.yml ./
COPY docs ./docs
COPY README.md ./

RUN pip install --no-cache-dir mkdocs-material pymdown-extensions && \
    mkdocs build --strict

EXPOSE 8000

CMD ["mkdocs", "serve", "-a", "0.0.0.0:8000"]
