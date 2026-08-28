# Docker Deployment Guide

## 🐳 Build & Run Locally

### Build Docker Image
```bash
docker build -t project-bronya .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e ASTRA_API_URL="http://astra:3000" \
  -e ASTRA_DEVICE_TOKEN="your_device_token" \
  -e KIOSK_LATITUDE="-7.44998" \
  -e KIOSK_LONGITUDE="110.2236" \
  project-bronya
```

### Using Docker Compose
```bash
docker-compose up -d
```

## 📦 GitHub Container Registry (GHCR)

### Pull from GHCR
```bash
docker pull ghcr.io/geber-suprabapak/project-bronya:latest
```

### Available Tags
- `latest` - Latest build from master branch
- `master` - Latest from master branch
- `v1.0.0` - Specific version tag (when using semver tags)
- `sha-abc123` - Specific commit

### Authentication
To pull private images:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

## 🚀 GitHub Actions Workflow

The workflow automatically:
1. ✅ Builds multi-platform images (amd64, arm64)
2. ✅ Pushes to GHCR on push to master
3. ✅ Creates tags based on git tags/branches
4. ✅ Uses layer caching for faster builds

### Trigger Build
- **Automatic**: Push to `master` branch or create a tag
- **Manual**: Go to Actions tab → "Build and Push Docker Image" → Run workflow

### Creating Version Tags
```bash
git tag v1.0.0
git push origin v1.0.0
```

This will create images with tags:
- `ghcr.io/geber-suprabapak/project-bronya:v1.0.0`
- `ghcr.io/geber-suprabapak/project-bronya:1.0`
- `ghcr.io/geber-suprabapak/project-bronya:1`
- `ghcr.io/geber-suprabapak/project-bronya:latest`

## 🔧 Environment Variables

Required environment variables:
- `ASTRA_API_URL` - Central Domain BFF API URL (default: `http://localhost:3000`)
- `ASTRA_DEVICE_TOKEN` - Device Identity service bearer token for Astra BFF
- `KIOSK_LATITUDE` - Terminal latitude coordinate (default: `-7.44998`)
- `KIOSK_LONGITUDE` - Terminal longitude coordinate (default: `110.2236`)

Optional environment variables:
- `DATABASE_URL` - Direct PostgreSQL connection string (for local DB mode)
- `PORT` - Port number (default: `3000`)
- `NODE_ENV` - `development` or `production`

## 📝 Notes

- The image uses Node.js 22 Alpine for minimal size
- Multi-stage build optimizes final image size
- Runs as non-root user (nextjs:1001) for security
- Uses Next.js standalone output for optimal performance
- Supports both amd64 and arm64 architectures
