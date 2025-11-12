#!/bin/bash
# Test runner script for Feedback Analyzer

echo "🧪 Running Feedback Analyzer Tests"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend Tests
echo -e "\n${YELLOW}Running Backend Tests...${NC}"
docker-compose exec -T backend pytest -v --cov=. --cov-report=term-missing
BACKEND_EXIT=$?

if [ $BACKEND_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
else
    echo -e "${RED}✗ Backend tests failed${NC}"
fi

# Frontend Tests
echo -e "\n${YELLOW}Running Frontend Tests...${NC}"
docker-compose exec -T frontend npm test
FRONTEND_EXIT=$?

if [ $FRONTEND_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
fi

# Summary
echo -e "\n${YELLOW}=================================="
echo "Test Summary"
echo "==================================${NC}"
echo -e "Backend:  $([ $BACKEND_EXIT -eq 0 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"
echo -e "Frontend: $([ $FRONTEND_EXIT -eq 0 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"

# Exit with failure if any tests failed
if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
    exit 1
fi

echo -e "\n${GREEN}✓ All tests passed!${NC}"
exit 0
