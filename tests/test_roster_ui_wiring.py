"""
Roster is intentionally disabled right now.

Instead of asserting UI wiring in static roster assets, validate that the backend
blocks the /roster page with a clear "not implemented" message.
"""


def test_roster_page_is_blocked(client):
    response = client.get("/roster")
    assert response.status_code == 403
    assert "not been implemented yet" in response.text.lower()
    assert "cullenpill 1.5" in response.text.lower()


