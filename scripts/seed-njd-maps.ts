import type { ProjectConfig } from "../src/lib/connectors/types";
import { prisma } from "../src/lib/db";
import { resolveMapsPlace } from "../src/lib/listen/maps";
import {
  NJD_CONTEXT_WHEN,
  NJD_CONTEXT_WORDS,
  NJD_EXCLUDE_WORDS,
  NJD_MAPS_PROJECT_ID,
  NJD_PROJECT_IDS,
} from "../src/lib/listen/njd";

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function applyListenRules(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { keywords: true },
  });
  if (!project) {
    console.log(`Skip missing project ${projectId}`);
    return false;
  }
  const config = (project.config ?? {}) as ProjectConfig;
  await prisma.project.update({
    where: { id: project.id },
    data: {
      config: {
        ...config,
        excludeWords: unique([...(config.excludeWords ?? []), ...NJD_EXCLUDE_WORDS]),
      },
    },
  });
  for (const keyword of project.keywords) {
    await prisma.keyword.update({
      where: { id: keyword.id },
      data: {
        requiredAny: unique([...(keyword.requiredAny ?? []), ...NJD_CONTEXT_WORDS]),
        requiredAnyWhen: unique([...(keyword.requiredAnyWhen ?? []), ...NJD_CONTEXT_WHEN]),
      },
    });
  }
  console.log(`Updated ignore words and “must also mention” on ${project.name} (${project.id})`);
  return true;
}

async function seedMapsPlace() {
  const project = await prisma.project.findUnique({ where: { id: NJD_MAPS_PROJECT_ID } });
  if (!project) {
    console.log(`Skip Maps seed — project ${NJD_MAPS_PROJECT_ID} is not on this server`);
    return;
  }
  const config = (project.config ?? {}) as ProjectConfig;
  const already = (config.googleMapsPlaces ?? []).some((place) => place.dataId || place.placeId);
  if (already) {
    console.log("Maps place already saved — no extra SerpAPI search.");
    return;
  }
  const resolved = await resolveMapsPlace({
    query: "New Jersey Developments",
    workspaceId: project.workspaceId,
    projectId: project.id,
    country: "eg",
  });
  if (!resolved.place) {
    console.log(resolved.skipped || "Could not resolve New Jersey Developments in Cairo");
    return;
  }
  const place = {
    ...resolved.place,
    label: resolved.place.label || "New Jersey Developments",
    query: "New Jersey Developments",
  };
  await prisma.project.update({
    where: { id: project.id },
    data: { config: { ...config, googleMapsPlaces: [...(config.googleMapsPlaces ?? []), place] } },
  });
  console.log(`Saved Maps place ${place.label} (${place.dataId || place.placeId}) — 1 SerpAPI search.`);
}

async function main() {
  for (const id of NJD_PROJECT_IDS) await applyListenRules(id);
  await seedMapsPlace();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
