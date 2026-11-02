import "dotenv/config";
import { youVersion } from "../services/youversion.js";
import { AppError } from "../utils/AppError.js";

// Run from backend-sermon-api. Outputs only safe diagnostics and Bible metadata.
const provider = youVersion();
if (!provider) {
  console.error(
    "App Key: missing. Set YVP_APP_KEY in backend-sermon-api/.env, then rerun.",
  );
  process.exitCode = 1;
} else {
  console.log("App Key: configured (value hidden).");
  try {
    const versions = await provider.translations();
    console.log(`Licensed English versions: ${versions.length}`);
    for (const abbreviation of ["NIV", "NLT", "NKJV"]) {
      const matches = versions.filter(
        (v) => v.abbreviation.toUpperCase() === abbreviation,
      );
      console.log(
        `${abbreviation}: ${matches.length ? matches.map((v) => v.id).join(", ") : "not returned by the licensed collection"}`,
      );
    }
    if (!versions.length)
      console.log(
        "The API returned no licensed English editions. Check the licenses on the account that owns this App Key.",
      );
  } catch (error) {
    console.error("Catalog check failed.");
    if (error instanceof AppError) {
      console.error(error.message);
      console.error(JSON.stringify(error.details ?? { kind: "unavailable" }));
      const status = (error.details as { upstreamStatus?: number } | undefined)
        ?.upstreamStatus;
      if (status === 401 || status === 403)
        console.error(
          "Check that this is the application App Key and that its account has accepted the required licenses.",
        );
      else if (status === 429)
        console.error("YouVersion rate limit reached. Wait before retrying.");
      else if (
        !status &&
        (error.details as { kind?: string } | undefined)?.kind !==
          "response_shape"
      )
        console.error(
          "Check network/DNS, firewall or proxy access to api.youversion.com.",
        );
    } else {
      console.error(
        "Unexpected failure. No raw error is printed to avoid exposing credentials.",
      );
    }
    process.exitCode = 1;
  }
}
