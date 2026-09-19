/**
 * A snapshot of the API's responses, captured from the seeded database.
 *
 * The app talks to the API when one is running and falls back to this when it
 * is not, which is what makes the GitHub Pages build a working demo instead of
 * a screenshot. Dates here are relative to the capture, so the demo shows a
 * plausible week rather than today's.
 */

export const queueSnapshot = [
  {
    "visitId": "v-4",
    "date": "2026-09-18",
    "patient": "Tom Bradley",
    "payer": "Medicare Part B",
    "unitRule": "medicare-8-minute",
    "note": {
      "id": "n-4",
      "visitId": "v-4",
      "subjective": "Shoulder improving, 2/10 with overhead reach.",
      "objective": {
        "interventions": [
          {
            "code": "97110",
            "description": "Scapular stabilization",
            "minutes": 18
          },
          {
            "code": "97530",
            "description": "Overhead lifting simulation",
            "minutes": 17
          },
          {
            "code": "97012",
            "description": "Mechanical traction",
            "minutes": 10
          }
        ]
      },
      "assessment": "Ready to progress load.",
      "plan": "Continue weekly."
    },
    "services": [
      {
        "code": "97110",
        "minutes": 18,
        "assistantMinutes": 0
      },
      {
        "code": "97530",
        "minutes": 17,
        "assistantMinutes": 0
      },
      {
        "code": "97012",
        "minutes": 10,
        "assistantMinutes": 0
      }
    ],
    "pricing": {
      "lines": [
        {
          "code": "97110",
          "description": "Therapeutic exercise",
          "units": 1,
          "minutes": 18,
          "modifier": null,
          "fullAllowed": 30.8,
          "allowed": 20.86,
          "mpprUnits": 1,
          "notes": [
            "MPPR applied to 1 of 1 unit(s): practice expense paid at 50%."
          ]
        },
        {
          "code": "97530",
          "description": "Therapeutic activities",
          "units": 1,
          "minutes": 17,
          "modifier": null,
          "fullAllowed": 34.64,
          "allowed": 34.64,
          "mpprUnits": 0,
          "notes": []
        },
        {
          "code": "97012",
          "description": "Mechanical traction",
          "units": 1,
          "minutes": 10,
          "modifier": null,
          "fullAllowed": 17.31,
          "allowed": 11.38,
          "mpprUnits": 1,
          "notes": [
            "MPPR applied to 1 of 1 unit(s): practice expense paid at 50%."
          ]
        }
      ],
      "totalTimedMinutes": 35,
      "totalUnits": 3,
      "grossAllowed": 82.75,
      "netAllowed": 66.88,
      "reductionTotal": 15.87,
      "patientResponsibility": 13.38,
      "planPays": 53.5,
      "warnings": []
    },
    "findings": [
      {
        "rule": "signature",
        "severity": "blocker",
        "message": "Note is unsigned. An unsigned note is an unbillable note."
      },
      {
        "rule": "plan-of-care-expiring",
        "severity": "warning",
        "message": "Plan of care expires 2026-09-27. Schedule re-certification."
      },
      {
        "rule": "progress-note-due",
        "severity": "blocker",
        "message": "10 visits since the last progress note. Medicare requires one every 10."
      }
    ],
    "billable": false
  },
  {
    "visitId": "v-1",
    "date": "2026-09-17",
    "patient": "Miriam Okonkwo",
    "payer": "Medicare Part B",
    "unitRule": "medicare-8-minute",
    "note": {
      "id": "n-1",
      "visitId": "v-1",
      "subjective": "Right knee stiff on waking, 4/10.",
      "objective": {
        "interventions": [
          {
            "code": "97110",
            "description": "Quad sets, heel slides, SLR",
            "minutes": 22,
            "assistantMinutes": 22
          },
          {
            "code": "97140",
            "description": "Patellar mobilization grade II",
            "minutes": 13,
            "assistantMinutes": 0
          }
        ],
        "measures": [
          {
            "name": "Knee flexion AROM",
            "value": 112,
            "unit": "deg"
          }
        ]
      },
      "assessment": "Quad activation improving; PTA delivered the exercise portion in full.",
      "plan": "Progress to step-downs; therapist to reassess ROM next visit.",
      "signedBy": "C. Tan, PT",
      "signedAt": "2026-09-19T04:36:38.345Z"
    },
    "services": [
      {
        "code": "97110",
        "minutes": 22,
        "assistantMinutes": 22
      },
      {
        "code": "97140",
        "minutes": 13,
        "assistantMinutes": 0
      }
    ],
    "pricing": {
      "lines": [
        {
          "code": "97110",
          "description": "Therapeutic exercise",
          "units": 1,
          "minutes": 22,
          "modifier": "CQ",
          "fullAllowed": 30.8,
          "allowed": 26.18,
          "mpprUnits": 0,
          "notes": [
            "CQ modifier \u2014 Assistant furnished 100.0% of the service, above the 10% de minimis standard. Paid at 85%."
          ]
        },
        {
          "code": "97140",
          "description": "Manual therapy",
          "units": 1,
          "minutes": 13,
          "modifier": null,
          "fullAllowed": 27.56,
          "allowed": 19.05,
          "mpprUnits": 1,
          "notes": [
            "MPPR applied to 1 of 1 unit(s): practice expense paid at 50%."
          ]
        }
      ],
      "totalTimedMinutes": 35,
      "totalUnits": 2,
      "grossAllowed": 58.36,
      "netAllowed": 45.23,
      "reductionTotal": 13.13,
      "patientResponsibility": 9.05,
      "planPays": 36.18,
      "warnings": []
    },
    "findings": [],
    "billable": true
  },
  {
    "visitId": "v-2",
    "date": "2026-09-17",
    "patient": "Daniel Reyes",
    "payer": "Blue Shield PPO",
    "unitRule": "ama-rule-of-eights",
    "note": {
      "id": "n-2",
      "visitId": "v-2",
      "subjective": "Lower back tight after desk work, 3/10.",
      "objective": {
        "interventions": [
          {
            "code": "97110",
            "description": "Core endurance progression",
            "minutes": 20
          },
          {
            "code": "97140",
            "description": "Lumbar joint mobilization",
            "minutes": 20
          }
        ]
      },
      "assessment": "Tolerating extension bias without peripheralization. Commercial plan bills on the AMA rule, so this visit is two units rather than three.",
      "plan": "Continue; re-evaluate at visit 12.",
      "signedBy": "C. Tan, PT",
      "signedAt": "2026-09-19T04:36:38.345Z"
    },
    "services": [
      {
        "code": "97110",
        "minutes": 20,
        "assistantMinutes": 0
      },
      {
        "code": "97140",
        "minutes": 20,
        "assistantMinutes": 0
      }
    ],
    "pricing": {
      "lines": [
        {
          "code": "97110",
          "description": "Therapeutic exercise",
          "units": 1,
          "minutes": 20,
          "modifier": null,
          "fullAllowed": 41.58,
          "allowed": 41.58,
          "mpprUnits": 0,
          "notes": []
        },
        {
          "code": "97140",
          "description": "Manual therapy",
          "units": 1,
          "minutes": 20,
          "modifier": null,
          "fullAllowed": 37.21,
          "allowed": 37.21,
          "mpprUnits": 0,
          "notes": []
        }
      ],
      "totalTimedMinutes": 40,
      "totalUnits": 2,
      "grossAllowed": 78.79,
      "netAllowed": 78.79,
      "reductionTotal": 0,
      "patientResponsibility": 78.79,
      "planPays": 0,
      "warnings": []
    },
    "findings": [
      {
        "rule": "progress-note-next-visit",
        "severity": "warning",
        "message": "Progress note is due at the next visit."
      },
      {
        "rule": "authorization-low",
        "severity": "warning",
        "message": "2 authorized visit(s) left. Request more now, not after the denial."
      }
    ],
    "billable": true
  },
  {
    "visitId": "v-3",
    "date": "2026-09-16",
    "patient": "Aisha Farouk",
    "payer": "UnitedHealthcare",
    "unitRule": "medicare-8-minute",
    "note": {
      "id": "n-3",
      "visitId": "v-3",
      "subjective": "New ACL referral, post-op week 3.",
      "objective": {
        "interventions": [
          {
            "code": "97162",
            "description": "PT evaluation, moderate complexity",
            "minutes": 45
          }
        ]
      },
      "assessment": "Moderate-complexity evaluation; effusion present, ROM limited.",
      "plan": "Initiate plan of care, 2x/week for 8 weeks.",
      "signedBy": "C. Tan, PT",
      "signedAt": "2026-09-19T04:36:38.345Z"
    },
    "services": [
      {
        "code": "97162",
        "minutes": 45,
        "assistantMinutes": 0
      }
    ],
    "pricing": {
      "lines": [
        {
          "code": "97162",
          "description": "PT evaluation, moderate",
          "units": 1,
          "minutes": 45,
          "modifier": null,
          "fullAllowed": 85.83,
          "allowed": 85.83,
          "mpprUnits": 0,
          "notes": []
        }
      ],
      "totalTimedMinutes": 0,
      "totalUnits": 1,
      "grossAllowed": 85.83,
      "netAllowed": 85.83,
      "reductionTotal": 0,
      "patientResponsibility": 35,
      "planPays": 50.83,
      "warnings": []
    },
    "findings": [],
    "billable": true
  }
] as const

export const adherenceSnapshot = [
  {
    "programId": "hp-1",
    "patient": "Miriam Okonkwo",
    "summary": {
      "score": 1,
      "expectedSessions": 28,
      "completedSessions": 28,
      "currentStreak": 14,
      "daysSinceLastActivity": 0,
      "byExercise": [
        {
          "exerciseId": "quad-sets",
          "name": "Quad sets",
          "expected": 14,
          "completed": 14,
          "score": 1
        },
        {
          "exerciseId": "heel-slides",
          "name": "Heel slides",
          "expected": 14,
          "completed": 14,
          "score": 1
        }
      ],
      "painTrend": "improving",
      "risk": "on-track",
      "recommendation": "Adherence is holding. Progress the program at the next visit."
    }
  },
  {
    "programId": "hp-2",
    "patient": "Daniel Reyes",
    "summary": {
      "score": 0.35,
      "expectedSessions": 20,
      "completedSessions": 7,
      "currentStreak": 1,
      "daysSinceLastActivity": 0,
      "byExercise": [
        {
          "exerciseId": "dead-bug",
          "name": "Dead bug",
          "expected": 10,
          "completed": 7,
          "score": 0.7
        },
        {
          "exerciseId": "hip-hinge",
          "name": "Hip hinge drill",
          "expected": 10,
          "completed": 0,
          "score": 0
        }
      ],
      "painTrend": "unknown",
      "risk": "at-risk",
      "recommendation": "Hip hinge drill is being skipped (0/10). Ask what is in the way before adding anything new."
    }
  },
  {
    "programId": "hp-4",
    "patient": "Tom Bradley",
    "summary": {
      "score": 0.083,
      "expectedSessions": 24,
      "completedSessions": 2,
      "currentStreak": 0,
      "daysSinceLastActivity": 12,
      "byExercise": [
        {
          "exerciseId": "pendulum",
          "name": "Pendulum swings",
          "expected": 14,
          "completed": 2,
          "score": 0.14285714285714285
        },
        {
          "exerciseId": "wall-slides",
          "name": "Wall slides",
          "expected": 10,
          "completed": 0,
          "score": 0
        }
      ],
      "painTrend": "unknown",
      "risk": "disengaged",
      "recommendation": "No activity for 12 days. Call before the next visit \u2014 this is the dropout window."
    }
  }
] as const

export const patientsSnapshot = [
  {
    "id": "pt-4",
    "name": "Tom Bradley",
    "payer": "Medicare Part B",
    "episodeId": "ep-4",
    "visitsUsed": 19,
    "authorizedVisits": 24,
    "certificationExpires": "2026-09-27"
  },
  {
    "id": "pt-3",
    "name": "Aisha Farouk",
    "payer": "UnitedHealthcare",
    "episodeId": "ep-3",
    "visitsUsed": 1,
    "authorizedVisits": 20,
    "certificationExpires": "2026-12-12"
  },
  {
    "id": "pt-1",
    "name": "Miriam Okonkwo",
    "payer": "Medicare Part B",
    "episodeId": "ep-1",
    "visitsUsed": 8,
    "authorizedVisits": null,
    "certificationExpires": "2026-10-08"
  },
  {
    "id": "pt-2",
    "name": "Daniel Reyes",
    "payer": "Blue Shield PPO",
    "episodeId": "ep-2",
    "visitsUsed": 10,
    "authorizedVisits": 12,
    "certificationExpires": "2026-11-02"
  }
] as const

export const payersSnapshot = [
  {
    "id": "medicare",
    "name": "Medicare Part B",
    "unitRule": "medicare-8-minute",
    "appliesMppr": true,
    "appliesAssistantReduction": true,
    "feeScheduleMultiplier": 1
  },
  {
    "id": "bcbs-ppo",
    "name": "Blue Shield PPO",
    "unitRule": "ama-rule-of-eights",
    "appliesMppr": false,
    "appliesAssistantReduction": false,
    "feeScheduleMultiplier": 1.35
  },
  {
    "id": "united",
    "name": "UnitedHealthcare",
    "unitRule": "medicare-8-minute",
    "appliesMppr": true,
    "appliesAssistantReduction": true,
    "feeScheduleMultiplier": 1.12
  }
] as const

