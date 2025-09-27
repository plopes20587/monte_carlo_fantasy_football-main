export async function getPlayers() {
  const r = await fetch("/players.json");
  if (!r.ok) throw new Error("Failed /players.json");
  return r.json();
}
export async function getProjections() {
  const r = await fetch("/projections.json");
  if (!r.ok) throw new Error("Failed /projections.json");
  return r.json();
}
