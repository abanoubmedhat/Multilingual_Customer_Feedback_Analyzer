#!/bin/bash
# Script to start the application using Docker Compose

set -e  # Exit on any error

echo "============================================"
echo "Starting Feedback Analyzer Application..."
echo "============================================"

# Make sure we're in the right directory
cd /mnt/c/Repos/feedback_analyzer

# Check if Docker is running
if ! sudo docker info > /dev/null 2>&1; then
    echo "Starting Docker service..."
    sudo service docker start
    sleep 2
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your configuration."
    exit 1
fi

echo ""
echo "Building and starting containers..."
echo "This may take a few minutes on first run..."
echo ""

# Build and start containers
sudo docker compose up --build -d

echo ""
echo "============================================"
echo "✅ Application started successfully!"
echo "============================================"
echo ""
echo "Services are available at:"
echo "  🌐 Frontend:  http://localhost:3000"
echo "  🔧 Backend:   http://localhost:8000"
echo "  📚 API Docs:  http://localhost:8000/docs"
echo "  🗄️  Database: localhost:5432"
echo ""
echo "To view logs:"
echo "  sudo docker compose logs -f"
echo ""
echo "To stop the application:"
echo "  sudo docker compose down"
echo ""
echo "To stop and remove all data:"
echo "  sudo docker compose down -v"
echo ""
