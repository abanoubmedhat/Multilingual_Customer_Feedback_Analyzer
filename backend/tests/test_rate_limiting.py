"""
Tests for rate limiting functionality.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch


@pytest.mark.asyncio
async def test_translate_rate_limit(client: AsyncClient, mock_gemini_response):
    """Test rate limiting on translate endpoint (30 requests per 60 seconds)."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        # Make 31 requests rapidly
        responses = []
        for i in range(31):
            response = await client.post(
                "/api/translate",
                json={"text": f"Test {i}"}
            )
            responses.append(response)
        
        # First 30 should succeed
        success_count = sum(1 for r in responses if r.status_code == 200)
        rate_limited_count = sum(1 for r in responses if r.status_code == 429)
        
        # At least one should be rate limited
        assert rate_limited_count >= 1
        assert success_count <= 30


@pytest.mark.asyncio
async def test_feedback_rate_limit(client: AsyncClient, sample_product, mock_gemini_response):
    """Test rate limiting on feedback endpoint (10 requests per 60 seconds)."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        # Make 11 requests rapidly
        responses = []
        for i in range(11):
            response = await client.post(
                "/api/feedback",
                json={
                    "text": f"Test feedback {i}",
                    "product": sample_product.name
                }
            )
            responses.append(response)
        
        # At least one should be rate limited
        rate_limited = [r for r in responses if r.status_code == 429]
        assert len(rate_limited) >= 1
        
        # Check error message
        if rate_limited:
            assert "Rate limit exceeded" in rate_limited[0].json()["detail"]
