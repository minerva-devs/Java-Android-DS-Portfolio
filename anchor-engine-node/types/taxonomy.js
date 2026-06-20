/**
 * Semantic Category Taxonomy for ECE
 *
 * Implements Standard 084: Semantic Shift Architecture
 * Defines the constrained vocabulary for automatic tagging and semantic search.
 *
 * Categories are designed to:
 * 1. Prevent tag sprawl while enabling relationship narrative discovery
 * 2. Support the "Relationship Historian" pattern for cross-domain application
 * 3. Enable both human-understandable and LLM-processable semantic classification
 */
export var SemanticCategory;
(function (SemanticCategory) {
    SemanticCategory["RELATIONSHIP"] = "#Relationship";
    SemanticCategory["NARRATIVE"] = "#Narrative";
    SemanticCategory["CODE"] = "#Code";
    SemanticCategory["TECHNICAL"] = "#Technical";
    SemanticCategory["INDUSTRY"] = "#Industry";
    SemanticCategory["LOCATION"] = "#Location";
    SemanticCategory["EMOTIONAL"] = "#Emotional";
    SemanticCategory["TEMPORAL"] = "#Temporal";
    SemanticCategory["CAUSAL"] = "#Causal";
    SemanticCategory["PERSONAL"] = "#Personal";
    SemanticCategory["PROFESSIONAL"] = "#Professional";
    SemanticCategory["EDUCATIONAL"] = "#Educational";
    SemanticCategory["CREATIVE"] = "#Creative";
    SemanticCategory["FINANCIAL"] = "#Financial";
    SemanticCategory["HEALTH"] = "#Health";
    SemanticCategory["SOCIAL"] = "#Social";
    SemanticCategory["ACADEMIC"] = "#Academic";
    SemanticCategory["BUSINESS"] = "#Business";
    SemanticCategory["LEGAL"] = "#Legal";
    SemanticCategory["SCIENTIFIC"] = "#Scientific";
    SemanticCategory["HISTORICAL"] = "#Historical";
    SemanticCategory["CULTURAL"] = "#Cultural";
    SemanticCategory["POLITICAL"] = "#Political";
    SemanticCategory["ENVIRONMENTAL"] = "#Environmental";
    SemanticCategory["TECHNOLOGICAL"] = "#Technological";
    SemanticCategory["SPIRITUAL"] = "#Spiritual";
    SemanticCategory["PHILOSOPHICAL"] = "#Philosophical";
    SemanticCategory["ETHICAL"] = "#Ethical";
    SemanticCategory["AESTHETIC"] = "#Aesthetic";
    SemanticCategory["PRACTICAL"] = "#Practical";
    SemanticCategory["THEORETICAL"] = "#Theoretical";
    SemanticCategory["EXPERIMENTAL"] = "#Experimental";
    SemanticCategory["DYNAMIC"] = "#Dynamic";
    SemanticCategory["STATIC"] = "#Static";
    SemanticCategory["COMPLEX"] = "#Complex";
    SemanticCategory["SIMPLE"] = "#Simple";
    SemanticCategory["TRADITIONAL"] = "#Traditional";
    SemanticCategory["MODERN"] = "#Modern";
    SemanticCategory["LOCAL"] = "#Local";
    SemanticCategory["GLOBAL"] = "#Global";
    SemanticCategory["SYNTHETIC"] = "#Synthetic";
    SemanticCategory["NATURAL"] = "#Natural";
    SemanticCategory["CONSTRUCTIVE"] = "#Constructive";
    SemanticCategory["DESTRUCTIVE"] = "#Destructive";
    SemanticCategory["TANGIBLE"] = "#Tangible";
    SemanticCategory["INTANGIBLE"] = "#Intangible";
    SemanticCategory["AUTHENTIC"] = "#Authentic";
    SemanticCategory["ARTIFICIAL"] = "#Artificial";
    SemanticCategory["ORGANIC"] = "#Organic";
    SemanticCategory["INORGANIC"] = "#Inorganic";
    SemanticCategory["BIOLOGICAL"] = "#Biological";
    SemanticCategory["PHYSICAL"] = "#Physical";
    SemanticCategory["ABSTRACT"] = "#Abstract";
    SemanticCategory["PROGRESSIVE"] = "#Progressive";
    SemanticCategory["REVOLUTIONARY"] = "#Revolutionary";
    SemanticCategory["COHERENT"] = "#Coherent";
    SemanticCategory["INCOHERENT"] = "#Incoherent";
    SemanticCategory["CONSISTENT"] = "#Consistent";
    SemanticCategory["INCONSISTENT"] = "#Inconsistent";
    SemanticCategory["COMPETITIVE"] = "#Competitive";
    SemanticCategory["COLLABORATIVE"] = "#Collaborative";
    SemanticCategory["CONTROLLED"] = "#Controlled";
    SemanticCategory["CLEAR"] = "#Clear";
    SemanticCategory["UNCLEAR"] = "#Unclear";
    SemanticCategory["PRECISE"] = "#Precise";
    SemanticCategory["VAGUE"] = "#Vague";
    SemanticCategory["UNIVERSAL"] = "#Universal";
    SemanticCategory["COMMON"] = "#Common";
    SemanticCategory["RARE"] = "#Rare";
    SemanticCategory["REGULAR"] = "#Regular";
    SemanticCategory["IRREGULAR"] = "#Irregular";
    SemanticCategory["NORMAL"] = "#Normal";
    SemanticCategory["ABNORMAL"] = "#Abnormal";
    SemanticCategory["TYPICAL"] = "#Typical";
    SemanticCategory["ATYPICAL"] = "#Atypical";
    SemanticCategory["STANDARD"] = "#Standard";
    SemanticCategory["NONSTANDARD"] = "#Nonstandard";
    SemanticCategory["ORDINARY"] = "#Ordinary";
    SemanticCategory["EXTRAORDINARY"] = "#Extraordinary";
    SemanticCategory["UNCERTAIN"] = "#Uncertain";
    SemanticCategory["CERTAIN"] = "#Certain";
    SemanticCategory["DEFINITE"] = "#Definite";
    SemanticCategory["INDEFINITE"] = "#Indefinite";
    SemanticCategory["FLEXIBLE"] = "#Flexible";
    SemanticCategory["RIGID"] = "#Rigid";
    SemanticCategory["ADAPTABLE"] = "#Adaptable";
    SemanticCategory["RESILIENT"] = "#Resilient";
    SemanticCategory["FRAGILE"] = "#Fragile";
    SemanticCategory["WEAK"] = "#Weak";
    SemanticCategory["ROBUST"] = "#Robust";
    SemanticCategory["DURABLE"] = "#Durable";
    SemanticCategory["ENDURING"] = "#Enduring";
    SemanticCategory["RESPONSIVE"] = "#Responsive";
    SemanticCategory["INNOVATIVE"] = "#Innovative";
    SemanticCategory["CONSERVATIVE"] = "#Conservative";
    SemanticCategory["LIBERAL"] = "#Liberal";
    SemanticCategory["RADICAL"] = "#Radical";
    SemanticCategory["MODERATE"] = "#Moderate";
    SemanticCategory["CENTRIST"] = "#Centrist";
    SemanticCategory["LIBERATING"] = "#Liberating";
    SemanticCategory["RESTRICTIVE"] = "#Restrictive";
    SemanticCategory["ANNIHILATING"] = "#Annihilating";
    SemanticCategory["ELIMINATING"] = "#Eliminating";
    SemanticCategory["ERASING"] = "#Erasing";
    SemanticCategory["DELETING"] = "#Deleting";
    SemanticCategory["REMOVING"] = "#Removing";
    SemanticCategory["EXCLUDING"] = "#Excluding";
    SemanticCategory["OMITTING"] = "#Omitting";
    SemanticCategory["SKIPPING"] = "#Skipping";
    SemanticCategory["BYPASSING"] = "#Bypassing";
    SemanticCategory["AVOIDING"] = "#Avoiding";
    SemanticCategory["DODGING"] = "#Dodging";
    SemanticCategory["EVADEING"] = "#Evading";
    SemanticCategory["ESCAPING"] = "#Escaping";
    SemanticCategory["FLEEING"] = "#Fleeing";
    SemanticCategory["RETREATING"] = "#Retreating";
    SemanticCategory["WITHDRAWING"] = "#Withdrawing";
    SemanticCategory["DEPARTING"] = "#Departing";
    SemanticCategory["EXITING"] = "#Exiting";
    SemanticCategory["LEAVING"] = "#Leaving";
    SemanticCategory["GOING"] = "#Going";
    SemanticCategory["GOVERNING"] = "#Governing";
    SemanticCategory["GO"] = "#Go"; // Go and proceeding aspects
})(SemanticCategory || (SemanticCategory = {}));
