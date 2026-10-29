/** Weekly growth plan request and response schemas. */
export const studyPlanSchemas = {
  "DailyLessonInput": {
    "type": "object",
    "required": [
      "day",
      "title",
      "content"
    ],
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
  "DailyLesson": {
    "type": "object",
      "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "studyPlanId": {
        "type": "string",
        "format": "uuid"
      },
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
        "nullable": true
      },
      "content": {
        "type": "string",
        "minLength": 1,
        "maxLength": 20000
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
  },
  "StudyPlanInput": {
    "type": "object",
    "required": [
      "title",
      "dailyLessons"
    ],
    "properties": {
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 5000
      },
      "sermonId": {
        "type": "string",
        "format": "uuid"
      },
      "dailyLessons": {
        "type": "array",
        "minItems": 1,
        "maxItems": 7,
        "description": "Unique day numbers within the week.",
        "items": {
          "$ref": "#/components/schemas/DailyLessonInput"
        }
      }
    }
  },
  "StudyPlan": {
    "type": "object",
      "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "sermonId": {
        "type": "string",
        "format": "uuid",
        "nullable": true
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "description": {
        "type": "string",
        "nullable": true
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
  },
  "StudyPlanDetail": {
    "type": "object",
      "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "sermonId": {
        "type": "string",
        "format": "uuid",
        "nullable": true
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      },
      "description": {
        "type": "string",
        "nullable": true
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      },
      "updatedAt": {
        "type": "string",
        "format": "date-time"
      },
      "dailyLessons": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/DailyLesson"
        }
      }
    }
  },
  "AttachStudyPlanInput": {
    "type": "object",
    "required": [
      "sermonId"
    ],
    "properties": {
      "sermonId": {
        "type": "string",
        "format": "uuid"
      }
    }
  },
  "LessonProgressInput": {
    "type": "object",
    "required": [
      "completed"
    ],
    "properties": {
      "completed": {
        "type": "boolean"
      }
    },
    "example": {
      "completed": true
    }
  },
  "LessonProgress": {
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
      "dailyLessonId": {
        "type": "string",
        "format": "uuid"
      },
      "completed": {
        "type": "boolean"
      },
      "completedAt": {
        "type": "string",
        "format": "date-time",
        "nullable": true
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
  },
  "StudyPlanProgress": {
    "type": "object",
      "properties": {
      "studyPlanId": {
        "type": "string",
        "format": "uuid"
      },
      "totalLessons": {
        "type": "integer"
      },
      "completedLessons": {
        "type": "integer"
      },
      "completionPercentage": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100
      },
      "dailyLessons": {
        "type": "array",
        "items": {
          "type": "object",
                  "properties": {
            "dailyLessonId": {
              "type": "string",
              "format": "uuid"
            },
            "day": {
              "type": "integer",
              "minimum": 1,
              "maximum": 7
            },
            "completed": {
              "type": "boolean"
            },
            "completedAt": {
              "type": "string",
              "format": "date-time",
              "nullable": true
            }
          }
        }
      }
    }
  }
};
