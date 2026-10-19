// Inventory.jsx "Add item" popup (single item / bulk upload) and the bulk "Upload Summary" popup.
import { Check, Plus, Upload, X } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { CenterSheet } from "./common";
import { pal } from "./palette";

export function AddItemSheet({
  open,
  showBulkUpload,
  onClose,
  onAddSingle,
  onShowBulk,
  onHideBulk,
  onDownloadTemplate,
  selectedBulkFile,
  onPickFile,
  onSubmit,
  isUploadingBulk,
}) {
  const { colors } = useTheme();
  const header = (
    <View style={styles.header}>
      <View style={{ width: 32 }} />
      <Text style={styles.headerTitle}>{showBulkUpload ? "Bulk Inventory Upload" : "Add item"}</Text>
      <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={6}>
        <X size={20} color={pal.gray400} />
      </Pressable>
    </View>
  );

  return (
    <CenterSheet open={open} onClose={onClose} header={header} maxHeight="85%">
      {!showBulkUpload ? (
        <View style={styles.optionsBody}>
          <Pressable onPress={onAddSingle} style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}>
            <View style={[styles.optionIcon, { backgroundColor: pal.orange100 }]}>
              <Plus size={24} color={pal.orange600} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Add single item</Text>
              <Text style={styles.optionDesc}>Manually enter item details, images, and variants.</Text>
            </View>
          </Pressable>
          <Pressable onPress={onShowBulk} style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}>
            <View style={[styles.optionIcon, { backgroundColor: pal.blue100 }]}>
              <Upload size={24} color={pal.blue600} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Bulk upload items</Text>
              <Text style={styles.optionDesc}>Upload multiple items at once using an Excel/CSV file.</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bulkBody}>
          <View style={styles.howBox}>
            <Upload size={20} color={pal.blue600} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>How it works</Text>
              <Text style={styles.howText}>
                {"1. Download our template file below.\n2. Fill in your item details following the format.\n3. Upload the completed file to add all items at once."}
              </Text>
            </View>
          </View>

          <Pressable onPress={onDownloadTemplate} style={styles.templateBtn}>
            <Text style={styles.templateText}>Download dummy Excel template (.xlsx)</Text>
          </Pressable>

          <Pressable
            onPress={onPickFile}
            disabled={isUploadingBulk}
            style={[
              styles.dropZone,
              selectedBulkFile
                ? { borderColor: pal.green300, backgroundColor: pal.green50 }
                : { borderColor: pal.plumBorder, backgroundColor: colors.primaryTint3 },
            ]}
          >
            <View style={styles.dropIcon}>
              {selectedBulkFile ? <Check size={32} color={pal.green600} /> : <Upload size={32} color={colors.primary} />}
            </View>
            <Text style={styles.dropTitle}>{selectedBulkFile ? selectedBulkFile.name : "Select Excel file to upload"}</Text>
            <Text style={styles.dropDesc}>
              {selectedBulkFile ? "File selected! Tap Submit to upload." : "Tap to choose your .xlsx file from device"}
            </Text>
          </Pressable>

          {selectedBulkFile ? (
            <Pressable
              onPress={onSubmit}
              disabled={isUploadingBulk}
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isUploadingBulk ? 0.5 : 1 }]}
            >
              {isUploadingBulk ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.submitText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Upload size={20} color="#ffffff" />
                  <Text style={styles.submitText}>Submit & Upload</Text>
                </>
              )}
            </Pressable>
          ) : null}

          <Pressable onPress={onHideBulk} style={styles.backOptions}>
            <Text style={styles.backOptionsText}>BACK TO OPTIONS</Text>
          </Pressable>
        </View>
      )}
    </CenterSheet>
  );
}

export function BulkResultDialog({ result, onClose, onDone }) {
  return (
    <CenterSheet open={Boolean(result)} onClose={onClose} backdrop="rgba(0,0,0,0.6)" contentStyle={styles.resultBody}>
      {result ? (
        <>
          <View style={styles.resultIcon}>
            <Check size={40} color={pal.green600} />
          </View>
          <Text style={styles.resultTitle}>Upload Summary</Text>
          <Text style={styles.resultSub}>Process completed successfully.</Text>
          <View style={styles.resultGrid}>
            <View style={[styles.resultBox, { backgroundColor: pal.green50, borderColor: pal.green100 }]}>
              <Text style={[styles.resultCount, { color: pal.green600 }]}>{result.successCount}</Text>
              <Text style={[styles.resultLabel, { color: pal.green700 }]}>SUCCESS</Text>
            </View>
            <View style={[styles.resultBox, { backgroundColor: pal.red50, borderColor: pal.red100 }]}>
              <Text style={[styles.resultCount, { color: pal.red600 }]}>{result.errorCount}</Text>
              <Text style={[styles.resultLabel, { color: pal.red700 }]}>FAILED</Text>
            </View>
          </View>
          {result.errors?.length > 0 ? (
            <View style={styles.errorsWrap}>
              <Text style={styles.errorsTitle}>FAILURE REASONS</Text>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {result.errors.map((err, idx) => (
                  <View key={`${idx}-${err.name || ""}`} style={styles.errorRow}>
                    <Text style={styles.errorName}>{err.name || `Row ${Number(err.index) + 2}`}</Text>
                    <Text style={styles.errorMsg}>{err.message}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {/* bg-slate-900 is not remapped by restaurantTheme.css (only black / gray-900) */}
          <Pressable onPress={onDone} style={[styles.gotIt, { backgroundColor: pal.slate900 }]}>
            <Text style={styles.gotItText}>Got it!</Text>
          </Pressable>
        </>
      ) : null}
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: pal.gray200,
    backgroundColor: "#ffffff",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: pal.gray900, textAlign: "center" },
  closeBtn: { padding: 4, borderRadius: 9999 },
  optionsBody: { paddingHorizontal: 16, paddingVertical: 24, gap: 16 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: pal.slate50,
    borderWidth: 1,
    borderColor: pal.slate100,
  },
  optionPressed: { backgroundColor: pal.slate100 },
  optionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: pal.slate900 },
  optionDesc: { fontSize: 12, color: pal.slate500 },
  bulkBody: { paddingHorizontal: 16, paddingVertical: 24, gap: 24 },
  howBox: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    backgroundColor: pal.blue50,
    borderWidth: 1,
    borderColor: pal.blue100,
    padding: 16,
  },
  howTitle: { fontSize: 14, fontWeight: "700", color: pal.blue900 },
  howText: { fontSize: 12, color: pal.blue700, lineHeight: 19, marginTop: 4 },
  templateBtn: {
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: pal.slate200,
    borderRadius: 16,
    alignItems: "center",
  },
  templateText: { fontSize: 14, fontWeight: "700", color: pal.slate600 },
  dropZone: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  dropTitle: { fontSize: 16, fontWeight: "700", color: pal.slate900, textAlign: "center" },
  dropDesc: { fontSize: 12, color: pal.slate500, textAlign: "center" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  submitText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  backOptions: { paddingVertical: 16, alignItems: "center" },
  backOptionsText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.4, color: pal.slate400 },
  resultBody: { padding: 24, alignItems: "stretch" },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: pal.green100,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  resultTitle: { fontSize: 20, fontWeight: "900", color: pal.slate900, textAlign: "center", marginBottom: 8 },
  resultSub: { fontSize: 14, color: pal.slate500, textAlign: "center", marginBottom: 24 },
  resultGrid: { flexDirection: "row", gap: 16, marginBottom: 24 },
  resultBox: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  resultCount: { fontSize: 24, fontWeight: "900" },
  resultLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  errorsWrap: { marginBottom: 32 },
  errorsTitle: { fontSize: 12, fontWeight: "700", color: pal.slate400, letterSpacing: 1.2, marginBottom: 12 },
  errorRow: { padding: 12, borderRadius: 12, backgroundColor: pal.slate50, borderWidth: 1, borderColor: pal.slate100, marginBottom: 8 },
  errorName: { fontSize: 12, fontWeight: "700", color: pal.slate900 },
  errorMsg: { fontSize: 10, color: pal.red500, marginTop: 2 },
  gotIt: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  gotItText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
