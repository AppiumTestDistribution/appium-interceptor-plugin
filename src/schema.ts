import { MockConfig } from './types';
import Ajv from 'ajv';
import betterAjvErrors from 'better-ajv-errors';

const MockSpecSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    HttpHeader: {
      anyOf: [
        {
          $ref: '#/definitions/Record<string,unknown>',
        },
        {
          properties: {
            add: {
              $ref: '#/definitions/Record<string,string>',
            },
            remove: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
          },
          type: 'object',
        },
      ],
    },
    'Record<string,string>': {
      type: 'object',
    },
    'Record<string,unknown>': {
      type: 'object',
    },
    UpdateBodySpec: {
      anyOf: [
        {
          properties: {
            jsonPath: {
              type: 'string',
            },
            value: {
              type: 'boolean',
            },
          },
          required: ['jsonPath', 'value'],
          type: 'object',
        },
        {
          properties: {
            jsonPath: {
              type: 'string',
            },
            value: {
              type: 'integer',
            },
          },
          required: ['jsonPath', 'value'],
          type: 'object',
        },
        {
          properties: {
            jsonPath: {
              type: 'string',
            },
            value: {
              type: 'string',
            },
          },
          required: ['jsonPath', 'value'],
          type: 'object',
        },
        {
          properties: {
            regexp: {
              type: 'string',
            },
            value: {
              type: 'string',
            },
          },
          type: 'object',
          required: ['regexp', 'value'],
        },
        {
          properties: {
            regexp: {
              type: 'string',
            },
            value: {
              type: 'boolean',
            },
          },
          type: 'object',
          required: ['regexp', 'value'],
        },
        {
          properties: {
            regexp: {
              type: 'string',
            },
            value: {
              type: 'integer',
            },
          },
          type: 'object',
          required: ['regexp', 'value'],
        },
      ],
    },
  },
  properties: {
    headers: {
      $ref: '#/definitions/HttpHeader',
    },
    method: {
      type: 'string',
    },
    requestBody: {
      type: 'string',
    },
    responseBody: {
      type: 'string',
    },
    responseHeaders: {
      $ref: '#/definitions/HttpHeader',
    },
    statusCode: {
      type: 'number',
    },
    updateRequestBody: {
      items: {
        $ref: '#/definitions/UpdateBodySpec',
      },
      type: 'array',
    },
    updateResponseBody: {
      items: {
        $ref: '#/definitions/UpdateBodySpec',
      },
      type: 'array',
    },
    updateUrl: {
      items: {
        properties: {
          regexp: {
            type: 'string',
          },
          value: {
            type: 'string',
          },
        },
        type: 'object',
        required: ['regexp', 'value'],
      },
      type: 'array',
    },
    url: {
      type: 'string',
    },
  },
  type: 'object',
};

function validateMockConfig(config: MockConfig) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(MockSpecSchema);

  const isValid = validate(config);
  if (!isValid) {
    const errors = betterAjvErrors(MockSpecSchema, config, validate.errors as [], {
      format: 'js',
    });
    throw new Error(`Invalid mock schema. Field ${errors[0]?.error}`);
  }
  return isValid;
}

export { MockSpecSchema, validateMockConfig };
