/** Dashboard request and response schemas. */
export const adminSchemas = {
  "AdminAnalytics": {
    "type": "object",
    "properties": {
      "users": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer",
            "minimum": 0
          },
          "active": {
            "type": "integer",
            "minimum": 0
          },
          "inactive": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "sermons": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer",
            "minimum": 0
          },
          "draft": {
            "type": "integer",
            "minimum": 0
          },
          "published": {
            "type": "integer",
            "minimum": 0
          },
          "archived": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "studyPlans": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer",
            "minimum": 0
          },
          "dailyLessons": {
            "type": "integer",
            "minimum": 0
          },
          "completedLessons": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "engagement": {
        "type": "object",
        "properties": {
          "uniqueViews": {
            "type": "integer",
            "minimum": 0
          },
          "uniqueListens": {
            "type": "integer",
            "minimum": 0
          },
          "bookmarks": {
            "type": "integer",
            "minimum": 0
          },
          "journalEntries": {
            "type": "integer",
            "minimum": 0
          },
          "groups": {
            "type": "integer",
            "minimum": 0
          },
          "discussionPosts": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    }
  },
  "AccountStatusInput": {
    "type": "object",
    "properties": {
      "isActive": {
        "type": "boolean"
      }
    },
    "required": [
      "isActive"
    ],
    "example": {
      "isActive": false
    }
  },
  "EngagementInput": {
    "type": "object",
    "properties": {
      "event": {
        "type": "string",
        "enum": [
          "view",
          "listen"
        ]
      }
    },
    "required": [
      "event"
    ]
  },
  "StudyPlanUpdateInput": {
    "type": "object",
    "minProperties": 1,
    "additionalProperties": false,
    "properties": {
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "description": {
        "type": "string",
        "nullable": true,
        "maxLength": 5000
      }
    }
  },
  "DailyLessonUpdateInput": {
    "type": "object",
    "minProperties": 1,
    "additionalProperties": false,
    "properties": {
      "day": {
        "type": "integer",
        "minimum": 1,
        "maximum": 7
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "passage": {
        "type": "string",
        "minLength": 1,
        "maxLength": 150
      },
      "content": {
        "type": "string",
        "minLength": 1,
        "maxLength": 20000
      }
    }
  },
  "SermonEngagement": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "userId": {
        "type": "string",
        "format": "uuid"
      },
      "sermonId": {
        "type": "string",
        "format": "uuid"
      },
      "event": {
        "type": "string",
        "enum": [
          "view",
          "listen"
        ]
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      },
      "updatedAt": {
        "type": "string",
        "format": "date-time"
      }
    }
  }
};
