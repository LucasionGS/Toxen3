import type { useModals, openModal } from "@mantine/modals";

/**
 * `@mantine/modals` does not re-export these from its package root, and the
 * previous workaround — importing from "@mantine/modals/lib/context" — reached
 * into build output covered by neither the package's `exports` map nor semver.
 *
 * Deriving them from the public API instead keeps them correct across Mantine
 * majors without depending on the internal file layout.
 */
export type ModalsContextProps = ReturnType<typeof useModals>;
export type ModalSettings = Parameters<typeof openModal>[0];
