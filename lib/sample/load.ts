import 'server-only'
import data from '@/data/sample/lumio.v1.json'
import bank from '@/data/instrument/bank.v1.json'
import cutoffRows from '@/data/config/cutoffs.json'
import { sampleSchema, type Sample } from '@/lib/sample/schema'
import { bankFactorsSchema, cutoffsVersion, sampleResults } from '@/lib/sample/results'

/** The cut-off version the sample's standings and changes use */
const SAMPLE_CUTOFFS = 1

/** The sample content, parsed once; a malformed file fails the build's first render, not a person's page */
export const SAMPLE: Sample = sampleSchema.parse(data)

export const samplePerson = (key: string) => {
  const person = SAMPLE.people.find((p) => p.key === key)
  if (!person) throw new Error(`sample: no person ${key}`)
  return person
}

/** The sample Results overview, built once: the bank's scales and the cut-offs of version 1 (lib/sample/results) */
export const SAMPLE_RESULTS = sampleResults(SAMPLE.results, bankFactorsSchema.parse(bank).factors, cutoffsVersion(cutoffRows, SAMPLE_CUTOFFS))
export const SAMPLE_CHANGE_MARGIN = cutoffsVersion(cutoffRows, SAMPLE_CUTOFFS).changeMargin
