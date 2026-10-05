# Doctor Network Match helper: one-time setup (about 5 minutes)

The Doctor Network Match page needs a small helper to reach the carrier directories and the NPI registry, because those sites refuse calls made straight from a web page. The helper runs free in your own Google account.

1. Go to https://script.google.com and click **New project**. Name it **Doctor Match Helper**.
2. Delete what is in the editor, paste in everything from [Code.gs](Code.gs), and click the save icon.
3. In the function menu at the top choose **testHelper**, click **Run**, and allow the permissions Google asks for (it says "connect to an external service"; that is the carrier lookups). The log at the bottom should show NPI registry results.
4. Click **Deploy > New deployment**. Click the gear next to "Select type" and pick **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Open the Doctor Network Match page, open **Settings** at the bottom, and paste that link into **Helper link**. Your browser remembers it.

"Anyone" means anyone holding that long link can use the helper, but it only fetches from the carrier directory sites listed in Code.gs, so it can't be used for anything else.

## Carriers that need a free developer key

Aetna and Anthem (and possibly Alignment and Molina) issue a free key for their public directory after you register on their developer site. Once you have one, add it in the Apps Script editor under **Project Settings > Script Properties** as described at the top of Code.gs. Claude can walk you through each sign-up.
