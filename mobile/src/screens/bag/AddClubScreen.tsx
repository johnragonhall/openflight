import React, { useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { CLUB_CATEGORIES } from '../../types/bag';
import type { ClubCategory, ClubTypeOption } from '../../types/bag';
import { createClub } from '../../db/bagDatabase';
import { ClubIcon } from '../../components/ClubIcon';
import { PressableScale } from '../../components/PressableScale';
import { C, R } from '../../theme';

export function AddClubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedCategory, setSelectedCategory] = useState<ClubCategory>('driver');
  const [selectedType, setSelectedType] = useState<ClubTypeOption>(CLUB_CATEGORIES[0].types[0]);
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const carouselRef = useRef<ScrollView>(null);

  const catDef = CLUB_CATEGORIES.find(c => c.category === selectedCategory)!;

  const selectCategory = (cat: typeof CLUB_CATEGORIES[0]) => {
    setSelectedCategory(cat.category);
    setSelectedType(cat.types[0]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createClub({
        category: selectedCategory,
        type_key: selectedType.key,
        abbreviation: selectedType.label,
        brand: brand.trim(),
        name: name.trim(),
        in_bag: true,
        bag_position: 0,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save club. Please try again.');
      setSaving(false);
    }
  };

  // Preview label shown at the bottom
  const previewName = name.trim() || (brand.trim() ? `${brand.trim()} ${selectedType.label}` : selectedType.label);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Category carousel */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>CLUB TYPE</Text>
            <ScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.carousel}
            >
              {CLUB_CATEGORIES.map((cat) => {
                const active = cat.category === selectedCategory;
                return (
                  <PressableScale
                    key={cat.category}
                    style={[s.catCard, active && s.catCardActive]}
                    onPress={() => selectCategory(cat)}
                    scale={0.94}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={cat.label}
                  >
                    <View style={[s.catIconWrap, active && s.catIconWrapActive]}>
                      <ClubIcon
                        category={cat.category}
                        size={32}
                        color={active ? C.accent : C.sub}
                      />
                    </View>
                    <Text style={[s.catLabel, active && s.catLabelActive]}>
                      {cat.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Sub-type chips — only show when category has multiple options */}
          {catDef.types.length > 1 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>CLUB</Text>
              <View style={s.chipGrid}>
                {catDef.types.map((type) => {
                  const active = type.key === selectedType.key;
                  return (
                    <PressableScale
                      key={type.key}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setSelectedType(type)}
                      scale={0.92}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={type.label}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        {type.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {/* Brand + Name inputs */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>DETAILS</Text>
            <View style={s.inputGroup}>
              <View style={s.inputRow}>
                <Text style={s.inputLabel}>Brand</Text>
                <TextInput
                  style={s.input}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="e.g. TaylorMade, Callaway, Ping…"
                  placeholderTextColor={C.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={60}
                  returnKeyType="next"
                />
              </View>
              <View style={[s.inputRow, s.inputRowBorder]}>
                <Text style={s.inputLabel}>Name</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Optional — e.g. Qi10 LS, Stealth 2"
                  placeholderTextColor={C.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={60}
                  returnKeyType="done"
                  onSubmitEditing={save}
                />
              </View>
            </View>
          </View>

          {/* Preview */}
          <View style={s.preview}>
            <Text style={s.previewLabel}>Preview</Text>
            <View style={s.previewRow}>
              <View style={s.previewIcon}>
                <ClubIcon category={selectedCategory} size={28} color={C.accent} />
              </View>
              <View style={s.previewInfo}>
                <Text style={s.previewAbbrev}>{selectedType.label}</Text>
                <Text style={s.previewName}>{previewName}</Text>
              </View>
              <Text style={s.previewCarry}>— yds</Text>
            </View>
          </View>

        </ScrollView>

        {/* Save button */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Adding club to bag' : 'Add club to bag'}
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            <Text style={s.saveBtnText}>
              {saving ? 'Adding…' : 'Add to Bag'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 28 },

  section: { gap: 10 },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginLeft: 4,
  },

  // Category carousel
  carousel: { gap: 10, paddingRight: 4 },
  catCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: 80,
  },
  catCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentSurface,
  },
  catIconWrap: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconWrapActive: { backgroundColor: C.accentDim },
  catLabel: { color: C.sub, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  catLabelActive: { color: C.accent },

  // Sub-type chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.md,
    backgroundColor: C.s1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  chipActive: {
    backgroundColor: C.accentSurface,
    borderColor: C.accent,
  },
  chipText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: C.accent },

  // Inputs
  inputGroup: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    gap: 12,
  },
  inputRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  inputLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
    width: 46,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 15,
  },

  // Preview
  preview: {
    gap: 10,
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 14,
  },
  previewLabel: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: { flex: 1, gap: 2 },
  previewAbbrev: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  previewName: { color: C.text, fontSize: 15, fontWeight: '600' },
  previewCarry: { color: C.muted, fontSize: 13 },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: R.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: C.bg, fontSize: 16, fontWeight: '800' },
});
