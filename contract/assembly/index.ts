import { PersistentMap, PersistentSet, env, storage, logging } from 'near-sdk-as'

const registry = new PersistentMap<string, string>('reg')
const schemas = new PersistentSet<string>('s')
const definitions = new PersistentSet<string>('d')
const aliases = new PersistentSet<string>('a')


export function getDID(accountId: string) : string {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(registry.contains(accountId), 'no did registered for this near account')
  return registry.getSome(accountId)
}

export function hasDID(accountId: string) : bool {
  if(registry.contains(accountId)){
    return true
  } else {
    return false
  }
}

export function putDID(accountId: string, did: string): bool {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(!registry.contains(accountId), 'did already registered for this near account')
  registry.set(accountId, did)
  logging.log('added ' + accountId + ':' + did)
  return true
}

export function initialize(done: bool): void {
  storage.set('done', done)
}

export function getInitialize(): bool {
  if (storage.contains('done')) {
    if(storage.getSome<bool>('done') == true ) {
      return true
    } else {
      return false
    }
  }
  return false
}

// Schemas
export function getSchemas(): Array<string> {
  return schemas.values()
}

export function findSchema(schema: string): bool {
  return schemas.has(schema)
}

export function addSchema(schema: string): bool {
  schemas.add(schema)
  return true
}

// Aliases
export function getAliases(): Array<string> {
  return aliases.values()
}

export function findAlias(alias: string): bool {
  return aliases.has(alias)
}

export function addAlias(alias: string): bool {
  aliases.add(alias)
  return true
}

// Definitions
export function getDefinitions(): Array<string> {
  return definitions.values()
}

export function findDefinition(def: string): bool {
  return definitions.has(def)
}

export function addDefinition(def: string): bool {
  definitions.add(def)
  return true
}


