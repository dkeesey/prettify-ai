/**
 * Storage utilities for Resume Coach job descriptions and profiles
 * Uses localStorage for MVP (Phase 1)
 */
import { getStoredValue, setStoredValue, removeStoredValue } from './storage'

// Storage keys for coach data
export const COACH_STORAGE_KEYS = {
  JOB_DESCRIPTIONS: 'coach_job_descriptions',
  PROFILES: 'coach_profiles',
  MASTER_RESUME: 'coach_master_resume',
} as const

/**
 * Job Description data model
 */
export interface JobDescription {
  id: string
  title: string           // "Senior FE Engineer"
  company: string         // "Starbucks"
  rawText: string         // Full JD text
  extractedKeywords: string[]
  extractedRequirements: string[]
  createdAt: string
}

/**
 * Profile data model (Phase 2)
 */
export interface Profile {
  id: string
  name: string            // "Dean-Starbucks-FE"
  basedOnJD: string       // JobDescription.id
  resumeMarkdown: string
  createdAt: string
}

/**
 * Generate a unique ID for new items
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// ============ JOB DESCRIPTIONS ============

/**
 * Get all saved job descriptions
 */
export function getJobDescriptions(): JobDescription[] {
  return getStoredValue<JobDescription[]>(COACH_STORAGE_KEYS.JOB_DESCRIPTIONS, [])
}

/**
 * Get a single job description by ID
 */
export function getJobDescription(id: string): JobDescription | null {
  const jds = getJobDescriptions()
  return jds.find(jd => jd.id === id) || null
}

/**
 * Save a new job description
 */
export function saveJobDescription(jd: Omit<JobDescription, 'id' | 'createdAt'>): JobDescription {
  const newJd: JobDescription = {
    ...jd,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }

  const existing = getJobDescriptions()
  setStoredValue(COACH_STORAGE_KEYS.JOB_DESCRIPTIONS, [...existing, newJd])

  return newJd
}

/**
 * Update an existing job description
 */
export function updateJobDescription(id: string, updates: Partial<JobDescription>): JobDescription | null {
  const jds = getJobDescriptions()
  const index = jds.findIndex(jd => jd.id === id)

  if (index === -1) return null

  const updated = { ...jds[index], ...updates }
  jds[index] = updated
  setStoredValue(COACH_STORAGE_KEYS.JOB_DESCRIPTIONS, jds)

  return updated
}

/**
 * Delete a job description
 */
export function deleteJobDescription(id: string): boolean {
  const jds = getJobDescriptions()
  const filtered = jds.filter(jd => jd.id !== id)

  if (filtered.length === jds.length) return false

  setStoredValue(COACH_STORAGE_KEYS.JOB_DESCRIPTIONS, filtered)
  return true
}

/**
 * Clear all job descriptions
 */
export function clearJobDescriptions(): void {
  removeStoredValue(COACH_STORAGE_KEYS.JOB_DESCRIPTIONS)
}

// ============ PROFILES (Phase 2) ============

/**
 * Get all saved profiles
 */
export function getProfiles(): Profile[] {
  return getStoredValue<Profile[]>(COACH_STORAGE_KEYS.PROFILES, [])
}

/**
 * Get a single profile by ID
 */
export function getProfile(id: string): Profile | null {
  const profiles = getProfiles()
  return profiles.find(p => p.id === id) || null
}

/**
 * Save a new profile
 */
export function saveProfile(profile: Omit<Profile, 'id' | 'createdAt'>): Profile {
  const newProfile: Profile = {
    ...profile,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }

  const existing = getProfiles()
  setStoredValue(COACH_STORAGE_KEYS.PROFILES, [...existing, newProfile])

  return newProfile
}

/**
 * Delete a profile
 */
export function deleteProfile(id: string): boolean {
  const profiles = getProfiles()
  const filtered = profiles.filter(p => p.id !== id)

  if (filtered.length === profiles.length) return false

  setStoredValue(COACH_STORAGE_KEYS.PROFILES, filtered)
  return true
}
