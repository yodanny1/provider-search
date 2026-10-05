# Provider Search Links

Medicare101.net carrier launcher: opens each contracted carrier's public provider search in its own tab.

Live page: https://yodanny1.github.io/provider-search/

`index.html` is a copy of the project's `carrier-launcher.html`; update both together.

## Doctor Network Match

`doctor-match.html` (live at https://yodanny1.github.io/provider-search/doctor-match.html) takes a client's list of doctors, finds each one in the national NPI registry, then searches each carrier's public Medicare provider directory (FHIR, Da Vinci PDex Plan-Net format) and ranks carrier / network / medical group options by how many doctors they keep, priority doctor first. Add `?demo=1` to the address to see it with made-up sample data.

Carrier directory addresses are in `DEFAULT_CARRIERS` at the top of the page script and can be overridden in the page's Settings. Most directories refuse direct browser calls, so the page falls back to a small Google Apps Script helper (`helper/Code.gs`, setup in `helper/SETUP.md`) that also holds any developer keys.
