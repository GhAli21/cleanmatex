import {
  isReadyFloorScreen,
  parseReadyListQuery,
  parseReadyListQueryFromApi,
  readyListEmptyKey,
  readyListPath,
  readyListQueryToApiFilters,
  readyListQueryToWorklist,
} from '@/lib/constants/ready-list-focus'

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('ready list query', () => {
  it('treats pickup and desk aliases as Pickup desk without hiding direct handover', () => {
    const desk = parseReadyListQuery(params('focus=counter'))
    expect(desk.desk).toBe(true)
    expect(desk.staged).toBe(false)
    expect(readyListQueryToWorklist(desk)).toEqual({})
    expect(parseReadyListQuery(params('focus=pickup')).desk).toBe(true)
    expect(parseReadyListQuery(params('focus=desk')).desk).toBe(true)
    expect(readyListPath(desk)).toBe('/dashboard/ready?focus=counter')
  })

  it('keeps legacy exclusive focus values as stacked flags', () => {
    expect(readyListQueryToWorklist(parseReadyListQuery(params('focus=shelf')))).toEqual({
      statusNarrow: ['ready'],
    })
    expect(readyListQueryToWorklist(parseReadyListQuery(params('focus=not_released')))).toEqual({
      statusNarrow: ['ready'],
    })
    expect(readyListQueryToWorklist(parseReadyListQuery(params('focus=collection')))).toEqual({
      collectionDue: true,
    })
    expect(readyListQueryToWorklist(parseReadyListQuery(params('focus=no_rack')))).toEqual({
      missingRack: true,
    })
    expect(readyListPath(parseReadyListQuery(params('focus=shelf')))).toBe(
      '/dashboard/ready?unreleased=1',
    )
  })

  it('stacks Pickup desk with due, rack, and one status band', () => {
    const query = parseReadyListQuery(params('focus=counter&due=1&norack=1&staged=1&page=3'))
    expect(query).toMatchObject({
      desk: true,
      staged: true,
      unreleased: false,
      collectionDue: true,
      missingRack: true,
      page: 3,
    })
    expect(readyListQueryToWorklist(query)).toEqual({
      statusNarrow: ['ready_for_pickup'],
      collectionDue: true,
      missingRack: true,
    })
    expect(readyListPath(query)).toBe(
      '/dashboard/ready?focus=counter&staged=1&due=1&norack=1&page=3',
    )
    expect(readyListQueryToApiFilters(query)).toEqual({
      ready_staged: '1',
      ready_due: '1',
      ready_norack: '1',
    })
  })

  it('treats both or neither status chips as the full Ready area', () => {
    expect(readyListQueryToWorklist(parseReadyListQuery(params('staged=1&unreleased=1')))).toEqual({})
    expect(readyListQueryToWorklist(parseReadyListQuery(params('')))).toEqual({})
  })

  it('reads stacked API flags and ignores ready_focus on non-legacy empty params', () => {
    const stacked = parseReadyListQueryFromApi(params('ready_staged=1&ready_due=true'))
    expect(readyListQueryToWorklist(stacked)).toEqual({
      statusNarrow: ['ready_for_pickup'],
      collectionDue: true,
    })
    const legacy = parseReadyListQueryFromApi(params('ready_focus=counter'))
    expect(legacy.desk).toBe(true)
    expect(readyListQueryToWorklist(legacy)).toEqual({})
  })

  it('scopes Ready-floor screens and empty-state keys', () => {
    expect(isReadyFloorScreen('ready')).toBe(true)
    expect(isReadyFloorScreen('ready_release')).toBe(true)
    expect(isReadyFloorScreen('processing')).toBe(false)
    expect(readyListEmptyKey(parseReadyListQuery(params('focus=counter')))).toBe('desk')
    expect(readyListEmptyKey(parseReadyListQuery(params('staged=1')))).toBe('counter')
    expect(readyListEmptyKey(parseReadyListQuery(params('focus=counter&due=1')))).toBe('collection')
    expect(readyListEmptyKey(parseReadyListQuery(params('staged=1&due=1')))).toBe('filtered')
    expect(readyListPath()).toBe('/dashboard/ready')
  })
})
