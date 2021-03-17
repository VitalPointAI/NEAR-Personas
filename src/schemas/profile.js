export const profileSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Profile',
    type: 'object',
    properties: {
      date: {
        type: 'string',
      },
      owner: {
        type: 'string',
      },
      name: {
          type: 'string',
      },
      avatar: {
        type: 'string',
      },
      shortBio: {
        type: 'string',
        title: 'text',
        maxLength: 4000,
      },
    },
  }