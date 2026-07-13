/**
 * Focus Protection - a private, user-built website focus list.
 *
 * The list is stored locally and is the source of truth for any native
 * enforcement layer. This screen deliberately avoids claiming that the
 * current JavaScript build can block Safari system-wide.
 */

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen } from "@/presentation/components/Screen";
import { Text } from "@/presentation/components/Text";
import { Button } from "@/presentation/components/Button";
import { ActionSheet } from "@/presentation/components/ActionSheet";
import { Mascot } from "@/presentation/components/Mascot";
import { elevation, radius, spacing } from "@/presentation/theme/tokens";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { useReducedMotion } from "@/presentation/hooks/useReducedMotion";
import { useReliableSafeAreaInsets } from "@/presentation/hooks/useReliableSafeAreaInsets";
import { useSafeBack } from "@/presentation/hooks/useSafeBack";
import { useStore } from "@/application/store";
import {
  normalizeDomain,
  siteLabel,
  type BlockedSite,
} from "@/domain/protection";

export { AppErrorBoundary as ErrorBoundary } from "@/presentation/components/AppErrorBoundary";

type SortMode = "az" | "recent";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ConfirmDialogProps {
  visible: boolean;
  siteName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  visible,
  siteName,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View
        onAccessibilityEscape={onCancel}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
        }}
      >
        <Pressable
          onPress={onCancel}
          accessible={false}
          importantForAccessibility="no"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.55)" },
          ]}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 360,
            maxHeight: "84%",
            overflow: "hidden",
            borderRadius: radius.card,
            backgroundColor: theme.color.surface,
            ...elevation.e2,
          }}
        >
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              padding: spacing.xl,
              paddingBottom: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.input,
                backgroundColor: theme.color.accentSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons
                name="trash-outline"
                size={21}
                color={theme.color.danger}
              />
            </View>
            <Text variant="title2" accessibilityRole="header">
              Remove website?
            </Text>
            <Text
              variant="body"
              dim
              style={{ marginTop: spacing.sm, lineHeight: 24 }}
            >
              Remove {siteName} from your focus list? This only deletes the
              saved entry from this device.
            </Text>
          </ScrollView>
          <View
            style={{
              gap: spacing.sm,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.xl,
            }}
          >
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: radius.input,
                backgroundColor: theme.color.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text variant="headline">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Remove from focus list"
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: radius.input,
                backgroundColor: theme.color.danger,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Text variant="headline" color={theme.color.textInverse}>
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface DomainFieldsProps {
  domain: string;
  nickname: string;
  error: string | null;
  domainRef?: RefObject<TextInput | null>;
  nicknameRef?: RefObject<TextInput | null>;
  onDomain: (value: string) => void;
  onNickname: (value: string) => void;
  onDomainSubmit?: () => void;
  onNicknameSubmit?: () => void;
}

function DomainFields({
  domain,
  nickname,
  error,
  domainRef,
  nicknameRef,
  onDomain,
  onNickname,
  onDomainSubmit,
  onNicknameSubmit,
}: DomainFieldsProps) {
  const theme = useTheme();

  return (
    <View>
      <View
        style={{
          overflow: "hidden",
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: error ? theme.color.danger : theme.color.hairline,
          backgroundColor: theme.color.surface,
        }}
      >
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}
        >
          <Text variant="caption" dim>
            Website address
          </Text>
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name="globe-outline"
              size={19}
              color={error ? theme.color.danger : theme.color.primary}
            />
            <TextInput
              ref={domainRef}
              value={domain}
              onChangeText={onDomain}
              onSubmitEditing={onDomainSubmit}
              placeholder="example.com"
              placeholderTextColor={theme.color.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
              blurOnSubmit={false}
              maxLength={512}
              underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              accessibilityLabel="Website address"
              accessibilityHint="Enter a domain such as example.com"
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: spacing.sm,
                color: theme.color.text,
                fontSize: 16,
                fontFamily: "Nunito_600SemiBold",
              }}
            />
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: theme.color.hairline }} />
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}
        >
          <Text variant="caption" dim>
            Label (optional)
          </Text>
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name="pricetag-outline"
              size={19}
              color={theme.color.primary}
            />
            <TextInput
              ref={nicknameRef}
              value={nickname}
              onChangeText={onNickname}
              onSubmitEditing={onNicknameSubmit}
              placeholder="Online casino"
              placeholderTextColor={theme.color.textDim}
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={48}
              underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              accessibilityLabel="Website label, optional"
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: spacing.sm,
                color: theme.color.text,
                fontSize: 16,
                fontFamily: "Nunito_600SemiBold",
              }}
            />
          </View>
        </View>
      </View>
      {error ? (
        <Text
          variant="footnote"
          color={theme.color.danger}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ marginTop: spacing.sm }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function AddSiteForm({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (domain: string) => void;
}) {
  const theme = useTheme();
  const addBlockedSite = useStore((state) => state.addBlockedSite);
  const [domain, setDomain] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const domainRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => domainRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, []);

  const fail = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
    domainRef.current?.focus();
  };

  const save = () => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      fail(
        "Enter a website such as example.com. Email addresses are not accepted.",
      );
      return;
    }
    const result = addBlockedSite(normalized, nickname);
    if (result === "duplicate") {
      fail(
        "That website, or a matching subdomain, is already in your focus list.",
      );
      return;
    }
    if (result !== "added") {
      fail("That website could not be added. Check the address and try again.");
      return;
    }
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onAdded(normalized);
  };

  const cancel = () => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <View
      style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        backgroundColor: theme.color.surfaceAlt,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.md,
        }}
      >
        <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
          Add a website
        </Text>
        <Pressable
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel adding website"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.input,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={theme.color.textDim} />
        </Pressable>
      </View>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        domainRef={domainRef}
        nicknameRef={nicknameRef}
        onDomain={(value) => {
          setDomain(value);
          if (error) setError(null);
        }}
        onNickname={setNickname}
        onDomainSubmit={() => nicknameRef.current?.focus()}
        onNicknameSubmit={save}
      />
      <View style={{ marginTop: spacing.md }}>
        <Button
          label="Add to focus list"
          onPress={save}
          disabled={!domain.trim()}
          full
        />
      </View>
    </View>
  );
}

function EditSiteSheet({
  siteId,
  onClose,
}: {
  siteId: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const updateBlockedSite = useStore((state) => state.updateBlockedSite);
  const site = useStore((state) =>
    siteId
      ? state.blockedSites.find((entry) => entry.id === siteId)
      : undefined,
  );
  const [domain, setDomain] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [open, setOpen] = useState(false);
  const domainRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (siteId != null) setOpen(true);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    const selected = useStore
      .getState()
      .blockedSites.find((entry) => entry.id === siteId);
    if (!selected) return;
    setDomain(selected.domain);
    setNickname(selected.nickname ?? "");
    setError(null);
    setSaveStatus("idle");
  }, [siteId]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const handleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    Keyboard.dismiss();
    setOpen(false);
    onClose();
  };

  const save = () => {
    if (!site || saveStatus !== "idle") return;
    setSaveStatus("saving");
    const result = updateBlockedSite(site.id, { domain, nickname });
    if (result === "invalid") {
      setError("Enter a website such as example.com.");
      setSaveStatus("idle");
      domainRef.current?.focus();
      return;
    }
    if (result === "duplicate") {
      setError("A matching website is already in your focus list.");
      setSaveStatus("idle");
      domainRef.current?.focus();
      return;
    }
    Keyboard.dismiss();
    setSaveStatus("saved");
    Haptics.selectionAsync().catch(() => {});
    closeTimer.current = setTimeout(handleClose, 500);
  };

  const saveLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? "Saved"
        : "Save changes";

  return (
    <ActionSheet visible={open} onClose={handleClose}>
      <Text
        variant="headline"
        accessibilityRole="header"
        style={{ marginBottom: spacing.md }}
      >
        Edit website
      </Text>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        domainRef={domainRef}
        nicknameRef={nicknameRef}
        onDomain={(value) => {
          setDomain(value);
          if (error) setError(null);
        }}
        onNickname={setNickname}
        onDomainSubmit={() => nicknameRef.current?.focus()}
        onNicknameSubmit={save}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          label={saveLabel}
          onPress={save}
          disabled={!domain.trim() || saveStatus !== "idle"}
          full
        />
        <Button label="Close" kind="secondary" onPress={handleClose} full />
      </View>
      {saveStatus === "saved" ? (
        <Text
          variant="caption"
          color={theme.color.success}
          accessibilityLiveRegion="polite"
          center
          style={{ marginTop: spacing.sm }}
        >
          Changes saved.
        </Text>
      ) : null}
    </ActionSheet>
  );
}

function SiteRow({
  site,
  first,
  onEdit,
  onRemove,
}: {
  site: BlockedSite;
  first: boolean;
  onEdit: () => void;
  onRemove: (id: string, label: string) => void;
}) {
  const theme = useTheme();
  const label = siteLabel(site);
  const detail = site.nickname
    ? `${site.domain} · Added ${fmtDate(site.addedAt)}`
    : `Added ${fmtDate(site.addedAt)}`;

  return (
    <View
      style={{
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.hairline,
      }}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onEdit();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${site.domain}, added ${fmtDate(site.addedAt)}`}
        accessibilityHint="Edits this website"
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          minHeight: 72,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingLeft: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: pressed ? theme.color.surfaceAlt : "transparent",
        })}
      >
        <View
          accessible={false}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.chip,
            backgroundColor: theme.color.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="globe-outline"
            size={18}
            color={theme.color.primary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" numberOfLines={1}>
            {label}
          </Text>
          <Text
            variant="caption"
            dim
            numberOfLines={1}
            style={{ marginTop: 2 }}
          >
            {detail}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={17}
          color={theme.color.textDim}
        />
      </Pressable>
      <Pressable
        onPress={() => onRemove(site.id, label)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} from focus list`}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          marginHorizontal: spacing.sm,
          borderRadius: radius.input,
          backgroundColor: pressed ? theme.color.accentSoft : "transparent",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <Ionicons name="trash-outline" size={19} color={theme.color.danger} />
      </Pressable>
    </View>
  );
}

function AddWebsiteButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add website"
      style={({ pressed }) => ({
        minHeight: 50,
        marginTop: spacing.lg,
        borderRadius: radius.button,
        backgroundColor: theme.color.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <Ionicons
        name="add-circle-outline"
        size={21}
        color={theme.color.onPrimary}
      />
      <Text variant="headline" color={theme.color.onPrimary}>
        Add website
      </Text>
    </Pressable>
  );
}

export default function Protection() {
  const theme = useTheme();
  const insets = useReliableSafeAreaInsets();
  const safeBack = useSafeBack();
  const { width } = useWindowDimensions();
  const blockedSites = useStore((state) => state.blockedSites);
  const removeBlockedSite = useStore((state) => state.removeBlockedSite);
  const screenScrollRef = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{
    id: string;
    label: string;
  } | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    AccessibilityInfo.announceForAccessibility(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const clearToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  };

  const openAdd = () => {
    clearToast();
    setAddOpen(true);
    setTimeout(
      () => screenScrollRef.current?.scrollTo({ y: 150, animated: true }),
      80,
    );
  };

  const visibleSites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? blockedSites.filter(
          (site) =>
            site.domain.toLowerCase().includes(normalizedQuery) ||
            (site.nickname ?? "").toLowerCase().includes(normalizedQuery),
        )
      : blockedSites;
    return [...filtered].sort((a, b) =>
      sort === "az"
        ? siteLabel(a).localeCompare(siteLabel(b))
        : b.addedAt - a.addedAt,
    );
  }, [blockedSites, query, sort]);

  const handleAdded = (domain: string) => {
    setAddOpen(false);
    setQuery("");
    setSort("recent");
    showToast(`${domain} added to your focus list`);
  };

  const handleRemove = (id: string, label: string) => {
    clearToast();
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmPending({ id, label });
  };

  const handleConfirmDelete = () => {
    if (!confirmPending) return;
    const { id, label } = confirmPending;
    setConfirmPending(null);
    removeBlockedSite(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    showToast(`${label} removed from your focus list`);
  };

  const openEdit = (id: string) => {
    clearToast();
    setEditingId(id);
  };

  const mascotSize = Math.min(132, Math.max(100, width * 0.335));
  const hasSites = blockedSites.length > 0;
  const showSearch = blockedSites.length >= 5 || query.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <Screen
        scrollRef={screenScrollRef}
        edges={["top", "bottom"]}
        contentStyle={{ paddingTop: spacing.md }}
      >
        <View
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Text variant="title1" accessibilityRole="header" style={{ flex: 1 }}>
            Focus Protection
          </Text>
          <Pressable
            onPress={safeBack}
            accessibilityRole="button"
            accessibilityLabel="Close Focus Protection"
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.input,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="close" size={22} color={theme.color.primary} />
          </Pressable>
        </View>

        <View
          style={{
            minHeight: 136,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.md,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: theme.color.hairline,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={17}
                color={theme.color.primary}
              />
              <Text
                variant="caption"
                color={theme.color.primary}
                style={{ textTransform: "uppercase" }}
              >
                Your focus list
              </Text>
            </View>
            <Text variant="title2" style={{ marginTop: spacing.sm }}>
              {hasSites
                ? `${blockedSites.length} website${blockedSites.length === 1 ? "" : "s"} saved`
                : "Create a private focus list"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                marginTop: spacing.sm,
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={theme.color.textDim}
              />
              <Text variant="footnote" dim>
                Saved only on this device
              </Text>
            </View>
          </View>
          <Mascot
            state="protect"
            size={mascotSize}
            motion="gentle"
            decorative
          />
        </View>

        {addOpen ? (
          <AddSiteForm
            onCancel={() => setAddOpen(false)}
            onAdded={handleAdded}
          />
        ) : (
          <AddWebsiteButton onPress={openAdd} />
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Text
              variant="headline"
              accessibilityRole="header"
              style={{ flex: 1 }}
            >
              Websites
            </Text>
            <Text variant="footnote" dim>
              {blockedSites.length}
            </Text>
            {blockedSites.length > 1 ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSort((current) => (current === "az" ? "recent" : "az"));
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  sort === "az"
                    ? "Sorted A to Z. Switch to recent"
                    : "Sorted by recent. Switch to A to Z"
                }
                style={({ pressed }) => ({
                  minWidth: 88,
                  minHeight: 44,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.input,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.xs,
                  backgroundColor: pressed
                    ? theme.color.surfaceAlt
                    : "transparent",
                })}
              >
                <Ionicons
                  name="swap-vertical-outline"
                  size={17}
                  color={theme.color.primary}
                />
                <Text variant="footnote" color={theme.color.primary}>
                  {sort === "az" ? "A-Z" : "Recent"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {showSearch ? (
            <View
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.md,
                paddingLeft: spacing.md,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                backgroundColor: theme.color.surface,
              }}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.color.textDim}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search websites"
                placeholderTextColor={theme.color.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                underlineColorAndroid="transparent"
                selectionColor={theme.color.primary}
                accessibilityLabel="Search websites"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 48,
                  paddingHorizontal: spacing.sm,
                  color: theme.color.text,
                  fontSize: 16,
                  fontFamily: "Nunito_600SemiBold",
                }}
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={theme.color.textDim}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!hasSites ? (
            <View
              accessible
              accessibilityLabel="No websites added"
              style={{
                minHeight: 76,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.md,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.color.hairline,
              }}
            >
              <Ionicons
                name="globe-outline"
                size={22}
                color={theme.color.textDim}
              />
              <Text variant="callout" dim>
                No websites added.
              </Text>
            </View>
          ) : visibleSites.length === 0 ? (
            <View
              style={{
                minHeight: 76,
                alignItems: "center",
                justifyContent: "center",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.color.hairline,
              }}
            >
              <Text variant="callout" dim>
                No websites match your search.
              </Text>
            </View>
          ) : (
            <View
              style={{
                overflow: "hidden",
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                backgroundColor: theme.color.surface,
              }}
            >
              {visibleSites.map((site, index) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  first={index === 0}
                  onEdit={() => openEdit(site.id)}
                  onRemove={handleRemove}
                />
              ))}
            </View>
          )}
        </View>

        <View
          accessible
          accessibilityLabel="Private by design. Only domains you add are stored. Browsing history is never read."
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            marginTop: spacing.xxl,
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={theme.color.primary}
          />
          <View style={{ flex: 1 }}>
            <Text variant="footnote">Private by design</Text>
            <Text
              variant="caption"
              dim
              style={{ marginTop: 2, lineHeight: 18 }}
            >
              Only domains you add are stored. Your browsing history is never
              read.
            </Text>
          </View>
        </View>
      </Screen>

      {toast && !addOpen && editingId === null && confirmPending === null ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radius.input,
            backgroundColor: theme.color.success,
            ...elevation.e2,
          }}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.color.textInverse}
          />
          <Text
            variant="callout"
            color={theme.color.textInverse}
            style={{ flex: 1 }}
          >
            {toast}
          </Text>
        </View>
      ) : null}

      <EditSiteSheet siteId={editingId} onClose={() => setEditingId(null)} />
      <ConfirmDialog
        visible={confirmPending !== null}
        siteName={confirmPending?.label ?? ""}
        onCancel={() => setConfirmPending(null)}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
}
