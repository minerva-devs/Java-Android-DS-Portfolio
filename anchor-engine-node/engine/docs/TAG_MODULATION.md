# Tag Modulation System

## Overview

The tag modulation system provides fine-grained control over tag generation and filtering, allowing you to adjust the balance between **strict entity-only tagging** and **lenient free-form tagging**.

## Configuration

All settings are in `user_settings.json` under the `tagging` section:

```json
{
  "tagging": {
    "modulation_level": 50,
    "atom_as_tag": false,
    "strict_atom_selection": true,
    "entity_extraction": {
      "enabled": true,
      "min_confidence": 0.6,
      "categories": ["PERSON", "ORG", "PRODUCT", "EVENT", "LOCATION"]
    },
    "blacklist_strictness": 75,
    "common_words_filter": true,
    "min_tag_length": 3,
    "max_tags_per_molecule": 20
  }
}
```

## Settings Explained

### `modulation_level` (0-100)
Controls how permissive the tag filtering is:

| Level | Behavior |
|-------|----------|
| **0** | Only strict entities (PERSON, ORG, PRODUCT, CamelCase terms, acronyms) |
| **25** | Entities + some meaningful common words |
| **50** | **DEFAULT** - Balanced mix of entities and common words |
| **75** | Mostly permissive, only obvious noise filtered |
| **100** | All tags allowed (no filtering except strict blacklist) |

**Example:**
- Input atoms: `[#AI, #the, #code, #ProjectX, #is, #running]`
- At 0%: `[#AI, #ProjectX]`
- At 50%: `[#AI, #ProjectX, #code, #running]`
- At 100%: `[#AI, #the, #code, #ProjectX, #is, #running]`

### `blacklist_strictness` (0-100)
Controls how aggressively blacklisted patterns are filtered:

| Level | What Gets Filtered |
|-------|-------------------|
| **0-25** | Only critical noise (color codes, HTML artifacts, errors) |
| **50** | + Medium noise (days, months, deprecated projects) |
| **75** | **DEFAULT** - + Generic tech terms (#code, #data, #system) |
| **100** | Maximum filtering, even borderline terms removed |

### `atom_as_tag` (boolean)
Whether atom labels automatically become tags:

- `false` (**recommended**): Atoms and tags are separate. Atoms are structural units, tags are semantic markers.
- `true`: Every atom label also becomes a tag (can create tag pollution).

### `strict_atom_selection` (boolean)
Controls atom extraction strictness:

- `true` (**DEFAULT**): Filters out common words, short tags, and noise from atoms
- `false`: More permissive atom extraction

### `entity_extraction`
Configuration for entity recognition:

- `enabled`: Turn entity extraction on/off
- `min_confidence`: Minimum confidence threshold (0.0-1.0)
- `categories`: Which entity types to extract

### `min_tag_length` (number)
Minimum character length for tags (default: 3). Filters out #a, #b, #1, etc.

### `max_tags_per_molecule` (number)
Cap on number of tags per molecule (default: 20). Prevents tag spam.

### `common_words_filter` (boolean)
Whether to filter common words (the, is, and, etc.) based on modulation level.

## Use Cases

### Scenario 1: Clean Entity-Only Tags
```json
{
  "modulation_level": 0,
  "blacklist_strictness": 100,
  "strict_atom_selection": true,
  "atom_as_tag": false
}
```
**Result:** Only proper entities like `#Coda`, `#Rob`, `#AnchorEngine`, `#RAG`

### Scenario 2: Balanced (Recommended)
```json
{
  "modulation_level": 50,
  "blacklist_strictness": 75,
  "strict_atom_selection": true,
  "atom_as_tag": false
}
```
**Result:** Entities + meaningful common words, noise filtered

### Scenario 3: Exploratory/Research
```json
{
  "modulation_level": 100,
  "blacklist_strictness": 25,
  "strict_atom_selection": false,
  "atom_as_tag": true
}
```
**Result:** All possible tags captured for later analysis

## How It Works

### Ingestion Pipeline

1. **Content → Atoms**: `scanAtoms()` extracts atomic concepts
   - In strict mode: filters common words, noise
   - In lenient mode: extracts more liberally

2. **Atoms → Molecules**: Atoms grouped into molecules

3. **Molecule Tags**: 
   - Atom labels collected
   - `applyTagModulation()` filters based on settings
   - Blacklist applied based on strictness
   - Common words filtered based on modulation level
   - Result capped at `max_tags_per_molecule`

4. **Database Storage**: Only filtered tags stored

### Filter Categories

**Always Filtered (Strict Blacklist):**
- Color codes: `#000`, `#fff`, `#6366f1`
- HTML artifacts: `#btn`, `#div`, `#class`
- Code artifacts: `#fn`, `#elif`, `#endif`
- Errors: `#incorrect_*`, `#error_*`
- System tags: `#manually_quarantined`, `#system`

**Filtered at Medium Strictness (50+):**
- Days/months: `#monday`, `#january`
- Generic: `#slow_pickup`, `#late_night`
- Deprecated: `#agentgpt`, `#babyagi`

**Filtered at High Strictness (75+):**
- Generic tech: `#code`, `#data`, `#system`, `#user`
- Generic adjectives: `#good`, `#bad`, `#new`

## API

```typescript
import { 
  modulateTags, 
  getTagModulationSettings,
  passesBlacklist,
  isEntityTag 
} from './utils/tag-modulation.js';

// Get current settings
const settings = getTagModulationSettings();

// Filter tags with custom modulation
const filtered = modulateTags(rawTags, 50, 75);

// Check if specific tag passes blacklist
const allowed = passesBlacklist('#code', 75);

// Check if tag is an entity (always kept)
const isEntity = isEntityTag('#ProjectX');
```

## Changing Settings

1. Edit `user_settings.json`
2. Restart the server
3. New ingestions use updated settings
4. Run tag cleanup to apply to existing data:
   ```javascript
   const { cleanupBlacklistedTags } = await import('./utils/tag-cleanup.js');
   await cleanupBlacklistedTags();
   ```

## Best Practices

1. **Start at 50%** modulation, adjust based on tag quality
2. **Keep strict_atom_selection=true** unless you need maximum extraction
3. **Set atom_as_tag=false** to keep atoms and tags separate
4. **Review tags periodically** and adjust blacklist if needed
5. **Use lower modulation** for production, **higher for research/exploration**
