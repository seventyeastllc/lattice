import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSavedResources, useSaveToggle } from "@/hooks/useSavedResources";
import {
  useCollections,
  useCollectionMutations,
  useCollectionItems,
  useCollectionItemMutations,
} from "@/hooks/useCollections";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";

const NAVY   = "#1E3A4A";
const TEAL   = "#2A9D8F";
const BG     = "#F7F9F8";
const BORDER = "#E2E8E6";
const TEXT   = "#1A2B35";
const MUTED  = "#5C7380";
const WHITE  = "#ffffff";

const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit", faith_based: "Faith-Based", school: "Education",
  medical: "Medical / Health", housing: "Housing", government: "Government",
  community: "Community Org", other: "Other",
};

function OrgMiniCard({
  org,
  isSaved,
  onUnsave,
  collectionId,
  onRemoveFromCollection,
  collections,
  onAddToCollection,
}: {
  org: { id: string; name: string; slug: string | null; org_type: string; county: string | null; description: string | null };
  isSaved?: boolean;
  onUnsave?: (id: string) => void;
  collectionId?: string;
  onRemoveFromCollection?: (orgId: string) => void;
  collections?: { id: string; name: string }[];
  onAddToCollection?: (collectionId: string, orgId: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "1.125rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/directory/${org.slug ?? org.id}`} style={{ textDecoration: "none" }}>
            <p style={{ fontWeight: 700, color: TEXT, fontSize: "0.9375rem", margin: 0, lineHeight: 1.3 }}>{org.name}</p>
          </Link>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.3rem", flexWrap: "wrap" }}>
            <span style={{ background: "#EEF4F3", color: NAVY, fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "3px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
            </span>
            {org.county && <span style={{ color: MUTED, fontSize: "0.775rem" }}>{org.county} County</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          {isSaved !== undefined && onUnsave && (
            <button
              onClick={() => onUnsave(org.id)}
              title="Remove bookmark"
              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.3rem 0.5rem", cursor: "pointer", color: MUTED, fontSize: "0.75rem" }}
            >
              ✕
            </button>
          )}
          {collectionId && onRemoveFromCollection && (
            <button
              onClick={() => onRemoveFromCollection(org.id)}
              title="Remove from collection"
              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.3rem 0.5rem", cursor: "pointer", color: MUTED, fontSize: "0.75rem" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {org.description && (
        <p style={{ color: MUTED, fontSize: "0.8125rem", lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {org.description}
        </p>
      )}

      {/* Add to collection */}
      {!collectionId && collections && onAddToCollection && (
        <div style={{ marginTop: "0.25rem", position: "relative" }}>
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.25rem 0.625rem", cursor: "pointer", color: MUTED, fontSize: "0.75rem", fontWeight: 500 }}
          >
            + Add to collection
          </button>
          {showAdd && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 180 }}>
              {collections.length === 0 ? (
                <p style={{ padding: "0.75rem 1rem", color: MUTED, fontSize: "0.8125rem", margin: 0 }}>No collections yet</p>
              ) : (
                collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => { onAddToCollection(col.id, org.id); setShowAdd(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "0.625rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", color: TEXT, borderBottom: `1px solid ${BORDER}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = BG)}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    {col.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CollectionSidebar({
  selected,
  onSelect,
  collections,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  userId,
}: {
  selected: string;
  onSelect: (id: string) => void;
  collections: { id: string; name: string }[];
  onCreateCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  userId: string;
}) {
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  void userId;

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateCollection(newName.trim());
    setNewName("");
    setShowNew(false);
  }

  function submitRename(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!renameVal.trim()) return;
    onRenameCollection(id, renameVal.trim());
    setRenamingId(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <button
        onClick={() => onSelect("all")}
        style={{
          textAlign: "left", padding: "0.625rem 0.875rem", borderRadius: "6px", border: "none", cursor: "pointer",
          background: selected === "all" ? NAVY : "none",
          color: selected === "all" ? WHITE : TEXT,
          fontWeight: selected === "all" ? 600 : 400, fontSize: "0.9rem",
        }}
      >
        🔖 All Saved
      </button>

      {collections.map(col => (
        <div key={col.id}>
          {renamingId === col.id ? (
            <form onSubmit={e => submitRename(e, col.id)} style={{ padding: "0.25rem 0.5rem" }}>
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem 0.5rem", border: `1px solid ${TEAL}`, borderRadius: "4px", fontSize: "0.875rem", outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.3rem" }}>
                <button type="submit" style={{ flex: 1, background: TEAL, color: WHITE, border: "none", borderRadius: "4px", padding: "0.3rem", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>Save</button>
                <button type="button" onClick={() => setRenamingId(null)} style={{ flex: 1, background: "none", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.3rem", fontSize: "0.75rem", cursor: "pointer" }}>Cancel</button>
              </div>
            </form>
          ) : confirmDeleteId === col.id ? (
            <div style={{ padding: "0.5rem 0.75rem", background: "#FEF2F2", borderRadius: "6px", border: "1px solid #FECACA" }}>
              <p style={{ fontSize: "0.8rem", color: "#991B1B", margin: "0 0 0.5rem", fontWeight: 600 }}>Delete "{col.name}"?</p>
              <p style={{ fontSize: "0.75rem", color: "#7F1D1D", margin: "0 0 0.5rem" }}>This won't remove your bookmarks.</p>
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <button onClick={() => { onDeleteCollection(col.id); setConfirmDeleteId(null); if (selected === col.id) onSelect("all"); }} style={{ flex: 1, background: "#DC2626", color: WHITE, border: "none", borderRadius: "4px", padding: "0.3rem", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: "none", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "0.3rem", fontSize: "0.75rem", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <button
                onClick={() => onSelect(col.id)}
                style={{
                  flex: 1, textAlign: "left", padding: "0.625rem 0.875rem", borderRadius: "6px", border: "none", cursor: "pointer",
                  background: selected === col.id ? NAVY : "none",
                  color: selected === col.id ? WHITE : TEXT,
                  fontWeight: selected === col.id ? 600 : 400, fontSize: "0.9rem",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                📁 {col.name}
              </button>
              <button
                onClick={() => { setRenamingId(col.id); setRenameVal(col.name); }}
                title="Rename"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem", color: MUTED, fontSize: "0.85rem", borderRadius: "4px", flexShrink: 0 }}
              >✏</button>
              <button
                onClick={() => setConfirmDeleteId(col.id)}
                title="Delete"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem", color: MUTED, fontSize: "0.85rem", borderRadius: "4px", flexShrink: 0 }}
              >🗑</button>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: "0.75rem", borderTop: `1px solid ${BORDER}`, paddingTop: "0.75rem" }}>
        {showNew ? (
          <form onSubmit={submitNew}>
            <input
              autoFocus
              placeholder="Collection name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.625rem", border: `1px solid ${TEAL}`, borderRadius: "6px", fontSize: "0.875rem", outline: "none", fontFamily: "inherit", marginBottom: "0.375rem" }}
            />
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button type="submit" style={{ flex: 1, background: TEAL, color: WHITE, border: "none", borderRadius: "6px", padding: "0.4rem", fontSize: "0.8125rem", cursor: "pointer", fontWeight: 600 }}>Create</button>
              <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, background: "none", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "0.4rem", fontSize: "0.8125rem", cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            style={{ width: "100%", textAlign: "left", padding: "0.5rem 0.875rem", background: "none", border: `1px dashed ${BORDER}`, borderRadius: "6px", cursor: "pointer", color: TEAL, fontSize: "0.875rem", fontWeight: 600 }}
          >
            + New Collection
          </button>
        )}
      </div>
    </div>
  );
}

function AllSavedPanel({
  user,
  savedIds,
  savedLoading,
  collections,
}: {
  user: { id: string };
  savedIds: string[];
  savedLoading: boolean;
  collections: { id: string; name: string }[];
}) {
  const { unsave } = useSaveToggle(user.id);
  const { addToCollection } = useCollectionItemMutations();

  const { data: savedOrgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["saved_orgs", savedIds],
    queryFn: async () => {
      if (savedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, org_type, county, description")
        .in("id", savedIds);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; slug: string | null; org_type: string; county: string | null; description: string | null }[];
    },
    enabled: savedIds.length > 0,
    networkMode: "always",
    retry: false,
  });

  if (savedLoading || orgsLoading) {
    return <p style={{ color: MUTED, fontSize: "0.875rem" }}>Loading saved organizations…</p>;
  }

  if (savedIds.length === 0) {
    return (
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "3rem 2rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>🔖</p>
        <p style={{ fontWeight: 700, color: TEXT, margin: "0 0 0.5rem", fontSize: "1.0625rem" }}>No saved organizations yet</p>
        <p style={{ color: MUTED, fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
          Browse the directory and bookmark organizations to access them here.
        </p>
        <Link to="/directory" style={{ display: "inline-block", background: TEAL, color: WHITE, fontWeight: 600, fontSize: "0.875rem", padding: "0.625rem 1.5rem", borderRadius: "6px", textDecoration: "none" }}>
          Browse the Directory
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
      {savedOrgs.map(org => (
        <OrgMiniCard
          key={org.id}
          org={org}
          isSaved={true}
          onUnsave={id => unsave.mutate(id)}
          collections={collections}
          onAddToCollection={(colId, orgId) => addToCollection.mutate({ collectionId: colId, orgId })}
        />
      ))}
    </div>
  );
}

function CollectionPanel({ collectionId }: { collectionId: string }) {
  const { data: items = [], isLoading } = useCollectionItems(collectionId);
  const { removeFromCollection } = useCollectionItemMutations();

  if (isLoading) return <p style={{ color: MUTED, fontSize: "0.875rem" }}>Loading…</p>;

  if (items.length === 0) {
    return (
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "3rem 2rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>📁</p>
        <p style={{ fontWeight: 700, color: TEXT, margin: "0 0 0.5rem" }}>This collection is empty</p>
        <p style={{ color: MUTED, fontSize: "0.9rem", margin: 0, lineHeight: 1.6 }}>
          Add organizations from your saved resources while browsing the directory.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
      {items.map(org => (
        <OrgMiniCard
          key={org.id}
          org={org}
          collectionId={collectionId}
          onRemoveFromCollection={orgId => removeFromCollection.mutate({ collectionId, orgId })}
        />
      ))}
    </div>
  );
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState("all");

  const { data: savedIds = [], isLoading: savedLoading } = useSavedResources(user?.id);
  const { data: collections = [] } = useCollections(user?.id);
  const { create, rename, remove } = useCollectionMutations(user?.id);

  if (!user) return <Navigate to="/login" replace />;

  const selectedCollection = collections.find(c => c.id === selected);

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <NavBar />

      {/* Header */}
      <div style={{ background: NAVY, padding: "2.5rem 2rem 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ color: TEAL, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>My Workspace</p>
          <h1 style={{ color: WHITE, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 0.375rem", lineHeight: 1.15 }}>My Resources</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", margin: 0 }}>Saved organizations and personal collections</p>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "2rem", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "2rem", alignItems: "start" }}>

          {/* Sidebar */}
          <div style={{ position: "sticky", top: "128px" }}>
            <CollectionSidebar
              selected={selected}
              onSelect={setSelected}
              collections={collections}
              onCreateCollection={name => create.mutate(name)}
              onRenameCollection={(id, name) => rename.mutate({ id, name })}
              onDeleteCollection={id => remove.mutate(id)}
              userId={user.id}
            />
          </div>

          {/* Main */}
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ color: TEXT, fontWeight: 700, fontSize: "1.0625rem", margin: 0 }}>
                {selected === "all" ? `All Saved (${savedIds.length})` : selectedCollection?.name ?? "Collection"}
              </h2>
            </div>

            {selected === "all" ? (
              <AllSavedPanel
                user={user}
                savedIds={savedIds}
                savedLoading={savedLoading}
                collections={collections}
              />
            ) : (
              <CollectionPanel collectionId={selected} />
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout override */}
      <style>{`
        @media (max-width: 720px) {
          .res-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  );
}
