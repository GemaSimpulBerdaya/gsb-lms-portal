import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const includeRegistry = args.has("--include-registry");

const uri = process.env.MONGODB_LMS_URI;
if (!uri) {
  console.error("MONGODB_LMS_URI is required");
  process.exit(1);
}

const TEAM_SOURCE = process.env.MONGODB_TEAM_ACCOUNT_COLLECTION || "volunteers";
const TEAM_TARGET = "team_accounts";
const REGISTRY_SOURCE = process.env.MONGODB_VOLUNTEER_COLLECTION || "volunteer_registry";
const REGISTRY_TARGET = "volunteers";

function usage() {
  console.log(`
Usage:
  node scripts/rename-team-volunteer-collections.mjs
  node scripts/rename-team-volunteer-collections.mjs --apply
  node scripts/rename-team-volunteer-collections.mjs --apply --include-registry

Default mode is dry-run.

Phases:
  1. Rename team account collection: ${TEAM_SOURCE} -> ${TEAM_TARGET}
  2. Optional registry rename: ${REGISTRY_SOURCE} -> ${REGISTRY_TARGET}

Only run --include-registry after team accounts have moved away from "${REGISTRY_TARGET}".
`);
}

async function collectionExists(db, name) {
  const collections = await db
    .listCollections({ name }, { nameOnly: true })
    .toArray();
  return collections.length > 0;
}

async function countIfExists(db, name) {
  if (!(await collectionExists(db, name))) return null;
  return db.collection(name).estimatedDocumentCount();
}

async function planRename(db, source, target) {
  const [sourceExists, targetExists, sourceCount, targetCount] = await Promise.all([
    collectionExists(db, source),
    collectionExists(db, target),
    countIfExists(db, source),
    countIfExists(db, target),
  ]);

  return {
    source,
    target,
    sourceExists,
    targetExists,
    sourceCount,
    targetCount,
    canApply: sourceExists && !targetExists,
    alreadyDone: !sourceExists && targetExists,
  };
}

async function applyRename(db, plan) {
  if (plan.alreadyDone) {
    console.log(`skip: ${plan.source} already appears to be renamed to ${plan.target}`);
    return;
  }
  if (!plan.canApply) {
    throw new Error(
      `cannot rename ${plan.source} -> ${plan.target}; sourceExists=${plan.sourceExists}, targetExists=${plan.targetExists}`,
    );
  }
  await db.collection(plan.source).rename(plan.target, { dropTarget: false });
  console.log(`renamed: ${plan.source} -> ${plan.target}`);
}

async function main() {
  if (args.has("--help") || args.has("-h")) {
    usage();
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const plans = [await planRename(db, TEAM_SOURCE, TEAM_TARGET)];
    if (includeRegistry) {
      plans.push(await planRename(db, REGISTRY_SOURCE, REGISTRY_TARGET));
    }

    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", plans }, null, 2));

    if (!apply) {
      console.log("dry-run only: re-run with --apply to execute.");
      return;
    }

    for (const plan of plans) {
      await applyRename(db, plan);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
