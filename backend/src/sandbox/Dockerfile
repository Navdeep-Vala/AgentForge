FROM node:20-bookworm-slim

# ── System dependencies ────────────────────────────────────────────────────────
# Install Chrome/Chromium and all required libraries
RUN apt-get update && apt-get install -y \
    # Browser & dependencies
    chromium \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    xdg-utils \
    # Dev tools
    git \
    python3 \
    python3-pip \
    php \
    composer \
    curl \
    wget \
    jq \
    unzip \
    zip \
    vim-tiny \
    less \
    # Additional libraries for headless Chrome
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome executable path for Puppeteer/Playwright
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright browsers and dependencies (optional, user can do this too)
# We'll install playwright system-wide to make it available
RUN npm install -g playwright puppeteer && \
    playwright install --with-deps chromium && \
    rm -rf /root/.cache/ms-playwright

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash sandbox
USER sandbox
WORKDIR /workspace

# Default: keep container alive
CMD ["sleep", "infinity"]
