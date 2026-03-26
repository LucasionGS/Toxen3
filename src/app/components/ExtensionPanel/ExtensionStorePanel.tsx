import React, { useEffect, useState } from "react";
import { Button, Text, TextInput, Badge, Group, Stack, Loader, Tabs } from "@mantine/core";
import { useForceUpdate } from "@mantine/hooks";
import { IconDownload, IconSearch, IconUpload, IconCheck, IconX, IconClock, IconRefresh, IconArrowBack, IconTrash } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import Settings from "../../toxen/Settings";
import User from "../../toxen/User";
import ExtensionManager, { Extension, ExtensionManifest } from "../../toxen/extensions/ExtensionManager";
//@ts-expect-error
import toxshop from "../../../assets/toxshop200.gif";

interface StoreExtension {
  id: number;
  extensionId: string;
  name: string;
  description: string;
  version: string;
  apiVersion: number;
  authorName: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  downloads: number;
  createdAt: string;
  /** Whether this extension is compatible with the Toxen web client. */
  webCompatible?: boolean;
}

function getInstallState(ext: StoreExtension): { label: string; icon: React.ReactNode; disabled: boolean; color?: string } {
  if (toxenapi.isDesktop()) {
    const local = ExtensionManager.extensions.get(ext.extensionId);
    if (!local) return { label: "Install", icon: <IconDownload size={14} />, disabled: false };
    if (local.manifest.version !== ext.version) return { label: "Update", icon: <IconRefresh size={14} />, disabled: false, color: "yellow" };
    return { label: "Installed", icon: <IconCheck size={14} />, disabled: true, color: "green" };
  } else {
    const webExt = ExtensionManager.webExtensions.get(ext.extensionId);
    if (!webExt) return { label: "Install", icon: <IconDownload size={14} />, disabled: false };
    if (webExt.manifest.version !== ext.version) return { label: "Update", icon: <IconRefresh size={14} />, disabled: false, color: "yellow" };
    return { label: "Installed", icon: <IconCheck size={14} />, disabled: true, color: "green" };
  }
}

function ExtensionCard({ ext, onDownload, showStatus, installing }: {
  ext: StoreExtension;
  onDownload?: (ext: StoreExtension) => void;
  showStatus?: boolean;
  installing?: boolean;
}) {
  const state = getInstallState(ext);
  return (
    <div style={{
      marginBottom: 12,
      padding: 12,
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 6,
      background: "rgba(255,255,255,0.03)"
    }}>
      <Group justify="space-between" align="flex-start">
        <div style={{ flex: 1 }}>
          <Group gap={8} align="center">
            <Text fw={600} size="lg">{ext.name}</Text>
            <Badge size="sm" variant="outline">v{ext.version}</Badge>
            <Badge size="sm" variant="light" color="gray">API v{ext.apiVersion}</Badge>
            {ext.webCompatible && (
              <Badge size="sm" color="blue" title="This extension can be installed on Toxen Web">Web</Badge>
            )}
            {showStatus && (
              <Badge
                size="sm"
                color={ext.status === "approved" ? "green" : ext.status === "rejected" ? "red" : "yellow"}
              >
                {ext.status}
              </Badge>
            )}
          </Group>
          <Text size="sm" style={{ opacity: 0.7, marginTop: 4 }}>{ext.description}</Text>
          <Group gap={12} mt={6}>
            <Text size="xs" style={{ opacity: 0.5 }}>by {ext.authorName}</Text>
            <Text size="xs" style={{ opacity: 0.5 }}>{ext.downloads} downloads</Text>
            <Text size="xs" style={{ opacity: 0.5 }}>ID: {ext.extensionId}</Text>
          </Group>
          {ext.status === "rejected" && ext.rejectionReason && (
            <Text size="sm" color="red" mt={4}>Rejection reason: {ext.rejectionReason}</Text>
          )}
        </div>
        <Stack gap={4}>
          {onDownload && ext.status === "approved" && (
            <Button
              size="xs"
              leftSection={state.icon}
              onClick={() => onDownload(ext)}
              disabled={state.disabled}
              loading={installing}
              color={state.color}
            >
              {state.label}
            </Button>
          )}
        </Stack>
      </Group>
    </div>
  );
}

function BrowseTab() {
  const [extensions, setExtensions] = useState<StoreExtension[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<number | null>(null);
  const forceUpdate = useForceUpdate();

  const fetchExtensions = async (query?: string) => {
    setLoading(true);
    try {
      const url = `${Settings.getServer()}/extensions/store${query ? `?search=${encodeURIComponent(query)}` : ""}`;
      const res = await Toxen.fetch(url);
      if (res.ok) {
        setExtensions(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch extensions:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchExtensions(); }, []);

  const handleDownload = async (ext: StoreExtension) => {
    if (!toxenapi.isDesktop() && !ext.webCompatible) {
      Toxen.error("This extension is not compatible with the web version.");
      return;
    }

    setInstalling(ext.id);
    try {
      if (toxenapi.isDesktop()) {
        // Desktop: download zip and extract to filesystem
        const url = `${Settings.getServer()}/extensions/store/${ext.id}/download`;
        const res = await Toxen.fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Download failed" }));
          Toxen.error(err.error || "Download failed");
          return;
        }

        const zipBuffer = await res.arrayBuffer();
        const yauzl = await import("yauzl");
        const fs = await import("fs");
        const fsp = fs.promises;
        const Path = await import("path");

        const extDir = ExtensionManager.getExtensionsDir();
        const targetDir = Path.resolve(extDir, ext.extensionId);

        // Remove old version if exists
        await fsp.rm(targetDir, { recursive: true, force: true });
        await fsp.mkdir(targetDir, { recursive: true });

        // Extract zip to targetDir
        await new Promise<void>((resolve, reject) => {
          yauzl.fromBuffer(Buffer.from(zipBuffer), { lazyEntries: true }, (err: Error | null, zipfile: any) => {
            if (err) return reject(err);

            zipfile.readEntry();
            zipfile.on("entry", (entry: any) => {
              if (/\/$/.test(entry.fileName)) {
                zipfile.readEntry();
              } else {
                zipfile.openReadStream(entry, async (err: Error | null, readStream: any) => {
                  if (err) return reject(err);
                  const outPath = Path.resolve(targetDir, entry.fileName);
                  const outDir = Path.dirname(outPath);
                  await fsp.mkdir(outDir, { recursive: true });
                  const writeStream = fs.createWriteStream(outPath);
                  readStream.pipe(writeStream);
                  writeStream.on("close", () => zipfile.readEntry());
                  writeStream.on("error", reject);
                });
              }
            });
            zipfile.on("end", () => resolve());
            zipfile.on("error", reject);
          });
        });

        // Re-discover and load extensions
        await ExtensionManager.discover();
        await ExtensionManager.loadAll();
      } else {
        // Web: fetch the extension manifest from server CDN, then load via eval
        const manifestUrl = `${Settings.getServer()}/extensions/store/${ext.id}/serve/extension.json`;
        const manifestRes = await Toxen.fetch(manifestUrl);
        if (!manifestRes.ok) {
          Toxen.error("Failed to fetch extension manifest from server.");
          return;
        }
        const manifest: ExtensionManifest = await manifestRes.json();

        // Basic validation to ensure the manifest has required fields
        if (!manifest || typeof manifest.id !== "string" || typeof manifest.name !== "string" || typeof manifest.version !== "string") {
          Toxen.error("Extension manifest is invalid or missing required fields.");
          return;
        }

        await ExtensionManager.installWebExtension(ext.id, manifest);
      }

      Toxen.log(`Extension "${ext.name}" installed successfully!`);
      forceUpdate();
      fetchExtensions(search || undefined);
    } catch (e) {
      console.error("Failed to install extension:", e);
      Toxen.error(`Failed to install extension: ${e.message}`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div>
      <Group gap={8} mb={12}>
        <TextInput
          placeholder="Search extensions..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fetchExtensions(search); }}
          style={{ flex: 1 }}
        />
        <Button onClick={() => fetchExtensions(search)} loading={loading}>Search</Button>
      </Group>

      {loading && extensions.length === 0 ? (
        <Group justify="center" p={20}><Loader /></Group>
      ) : extensions.length === 0 ? (
        <Text style={{ opacity: 0.5 }}>No extensions found.</Text>
      ) : (
        extensions.map(ext => (
          <ExtensionCard
            key={ext.id}
            ext={ext}
            onDownload={toxenapi.isDesktop() || ext.webCompatible ? handleDownload : undefined}
            installing={installing === ext.id}
          />
        ))
      )}
    </div>
  );
}

function SubmitTab() {
  const [selectedExtId, setSelectedExtId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [myExtensions, setMyExtensions] = useState<StoreExtension[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const user = User.getCurrentUser();

  const fetchMyExtensions = async () => {
    setLoadingMine(true);
    try {
      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store/mine`);
      if (res.ok) {
        setMyExtensions(await res.json());
      }
    } catch { /* ignore */ }
    setLoadingMine(false);
  };

  useEffect(() => { fetchMyExtensions(); }, []);

  // Get installed extensions that the current user can submit
  const submittableExtensions = (() => {
    if (!user) return [];
    return Array.from(ExtensionManager.extensions.values()).filter(ext => {
      // Can submit if authorId matches current user, or authorId is not set
      return ext.manifest.authorId === undefined || ext.manifest.authorId === user.id;
    });
  })();

  const handleSubmit = async () => {
    if (!toxenapi.isDesktop()) {
      Toxen.error("Extensions can only be submitted from the desktop version.");
      return;
    }
    if (!user) {
      Toxen.error("You must be logged in to submit extensions.");
      return;
    }
    if (!selectedExtId) {
      Toxen.error("Please select an extension to submit.");
      return;
    }

    const ext = ExtensionManager.extensions.get(selectedExtId);
    if (!ext) {
      Toxen.error("Selected extension not found.");
      return;
    }

    setSubmitting(true);
    try {
      const fs = await import("fs");
      const fsp = fs.promises;
      const Path = await import("path");
      const yazl = await import("yazl");

      const manifestPath = Path.resolve(ext.dirPath, "extension.json");

      // If authorId is missing, add it to the manifest file
      if (ext.manifest.authorId === undefined) {
        ext.manifest.authorId = user.id;
        await fsp.writeFile(manifestPath, JSON.stringify(ext.manifest, null, 2), "utf-8");
      }

      // Recursively collect all files in the extension directory
      const collectFiles = async (dir: string, base: string): Promise<{ abs: string; rel: string }[]> => {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        const results: { abs: string; rel: string }[] = [];
        for (const entry of entries) {
          const absPath = Path.join(dir, entry.name);
          const relPath = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            results.push(...await collectFiles(absPath, relPath));
          } else {
            results.push({ abs: absPath, rel: relPath });
          }
        }
        return results;
      };

      const files = await collectFiles(ext.dirPath, "");

      // Create zip using yazl
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const zipfile = new yazl.ZipFile();
        for (const file of files) {
          zipfile.addFile(file.abs, file.rel);
        }
        const chunks: Buffer[] = [];
        zipfile.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        zipfile.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
        zipfile.outputStream.on("error", reject);
        zipfile.end();
      });

      const blob = new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" });
      const formData = new FormData();
      formData.append("extensionId", ext.manifest.id);
      formData.append("name", ext.manifest.name);
      formData.append("description", ext.manifest.description || "");
      formData.append("version", ext.manifest.version);
      formData.append("apiVersion", String(Extension.apiVersion));
      formData.append("file", blob, `${ext.manifest.id}.zip`);

      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        Toxen.log("Extension submitted for review!");
        setSelectedExtId(null);
        fetchMyExtensions();
      } else {
        Toxen.error(data.error || "Submission failed");
      }
    } catch (e) {
      Toxen.error(`Submission failed: ${e.message}`);
    }
    setSubmitting(false);
  };

  if (!user) {
    return <Text>You must be logged in to submit extensions.</Text>;
  }

  return (
    <div>
      <h3>Submit Extension</h3>
      <Text size="sm" style={{ opacity: 0.7, marginBottom: 12 }}>
        Select one of your installed extensions to submit to the store. It will be zipped and uploaded automatically for admin review.
      </Text>

      {submittableExtensions.length === 0 ? (
        <Text style={{ opacity: 0.5 }}>No submittable extensions found. Install an extension locally first, or ensure the extension's authorId matches your account.</Text>
      ) : (
        <Stack gap={8}>
          {submittableExtensions.map(ext => (
            <div
              key={ext.manifest.id}
              onClick={() => setSelectedExtId(ext.manifest.id)}
              style={{
                padding: 10,
                border: selectedExtId === ext.manifest.id ? "2px solid var(--mantine-color-blue-6)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                cursor: "pointer",
                background: selectedExtId === ext.manifest.id ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)",
              }}
            >
              <Group gap={8} align="center">
                <Text fw={600}>{ext.manifest.name}</Text>
                <Badge size="sm" variant="outline">v{ext.manifest.version}</Badge>
                <Badge size="sm" variant="light" color="gray">ID: {ext.manifest.id}</Badge>
                {ext.manifest.authorId === undefined && (
                  <Badge size="xs" color="yellow">authorId will be set on submit</Badge>
                )}
              </Group>
              {ext.manifest.description && <Text size="sm" style={{ opacity: 0.7, marginTop: 2 }}>{ext.manifest.description}</Text>}
            </div>
          ))}
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedExtId}
            leftSection={<IconUpload size={16} />}
            mt={8}
          >
            Submit for Review
          </Button>
        </Stack>
      )}

      <h3 style={{ marginTop: 24 }}>My Submissions</h3>
      {loadingMine ? (
        <Group justify="center" p={20}><Loader /></Group>
      ) : myExtensions.length === 0 ? (
        <Text style={{ opacity: 0.5 }}>You haven't submitted any extensions yet.</Text>
      ) : (
        myExtensions.map(ext => (
          <ExtensionCard key={ext.id} ext={ext} showStatus />
        ))
      )}
    </div>
  );
}

function AdminTab() {
  const [allExtensions, setAllExtensions] = useState<StoreExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});

  const fetchAll = async (query?: string) => {
    setLoading(true);
    try {
      const url = `${Settings.getServer()}/extensions/store/all${query ? `?search=${encodeURIComponent(query)}` : ""}`;
      const res = await Toxen.fetch(url);
      if (res.ok) {
        setAllExtensions(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store/${id}/approve`, { method: "POST" });
      if (res.ok) {
        Toxen.log("Extension approved!");
        fetchAll(search || undefined);
      } else {
        const data = await res.json();
        Toxen.error(data.error || "Approve failed");
      }
    } catch { /* ignore */ }
  };

  const handleReject = async (id: number) => {
    try {
      const reason = rejectionReasons[id] || "";
      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        Toxen.log("Extension rejected.");
        fetchAll(search || undefined);
      } else {
        const data = await res.json();
        Toxen.error(data.error || "Reject failed");
      }
    } catch { /* ignore */ }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store/${id}/revoke`, { method: "POST" });
      if (res.ok) {
        Toxen.log("Extension revoked to pending.");
        fetchAll(search || undefined);
      } else {
        const data = await res.json();
        Toxen.error(data.error || "Revoke failed");
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Permanently delete extension "${name}"? This cannot be undone.`)) return;
    try {
      const res = await Toxen.fetch(`${Settings.getServer()}/extensions/store/${id}`, { method: "DELETE" });
      if (res.ok) {
        Toxen.log("Extension permanently deleted.");
        fetchAll(search || undefined);
      } else {
        const data = await res.json();
        Toxen.error(data.error || "Delete failed");
      }
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h3>Manage Extensions</h3>
      <Group gap={8} mb={12}>
        <TextInput
          placeholder="Search all extensions..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fetchAll(search); }}
          style={{ flex: 1 }}
        />
        <Button onClick={() => fetchAll(search)} loading={loading} size="sm">Search</Button>
      </Group>

      {loading && allExtensions.length === 0 ? (
        <Group justify="center" p={20}><Loader /></Group>
      ) : allExtensions.length === 0 ? (
        <Text style={{ opacity: 0.5 }}>No extensions found.</Text>
      ) : (
        allExtensions.map(ext => (
          <div key={ext.id} style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            background: "rgba(255,255,255,0.03)"
          }}>
            <ExtensionCard ext={ext} showStatus />
            <Group gap={8} mt={8}>
              {ext.status !== "approved" && (
                <Button
                  size="xs"
                  color="green"
                  leftSection={<IconCheck size={14} />}
                  onClick={() => handleApprove(ext.id)}
                >
                  Approve
                </Button>
              )}
              {ext.status === "approved" && (
                <Button
                  size="xs"
                  color="yellow"
                  leftSection={<IconArrowBack size={14} />}
                  onClick={() => handleRevoke(ext.id)}
                >
                  Revoke to Pending
                </Button>
              )}
              {ext.status !== "rejected" && (
                <>
                  <TextInput
                    placeholder="Rejection reason (optional)"
                    size="xs"
                    value={rejectionReasons[ext.id] || ""}
                    onChange={(e) => setRejectionReasons(prev => ({
                      ...prev,
                      [ext.id]: e.currentTarget.value
                    }))}
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="xs"
                    color="red"
                    leftSection={<IconX size={14} />}
                    onClick={() => handleReject(ext.id)}
                  >
                    Reject
                  </Button>
                </>
              )}
              <Button
                size="xs"
                color="red"
                variant="outline"
                leftSection={<IconTrash size={14} />}
                onClick={() => handleDelete(ext.id, ext.name)}
              >
                Delete
              </Button>
            </Group>
          </div>
        ))
      )}
    </div>
  );
}

export default function ExtensionStorePanel() {
  const user = User.getCurrentUser();
  const isAdmin = user?.isAdmin() ?? false;

  return (
    <div>
      <h2>Extension Store</h2>
      <Text size="sm" style={{ opacity: 0.7, marginBottom: 12 }}>
        Browse, install, and submit extensions for Toxen.
      </Text>
      <Tabs defaultValue="browse">
        <Tabs.List>
          <Tabs.Tab value="browse" leftSection={<IconSearch size={14} />}>Browse</Tabs.Tab>
          {user && <Tabs.Tab value="submit" leftSection={<IconUpload size={14} />}>Submit</Tabs.Tab>}
          {isAdmin && <Tabs.Tab value="admin" leftSection={<IconClock size={14} />}>Admin Review</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="browse" pt={12}>
          <BrowseTab />
        </Tabs.Panel>

        {user && (
          <Tabs.Panel value="submit" pt={12}>
            <SubmitTab />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="admin" pt={12}>
            <AdminTab />
          </Tabs.Panel>
        )}
      </Tabs>
      {
        Math.random() < 0.01 && (
          <img style={{
            marginBottom: -32,
            marginLeft: -40,
          }} src={toxshop} alt="Toxshop" />
        )
      }
    </div>
  );
}
