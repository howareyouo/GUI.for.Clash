import type { ProfileType } from '@/stores'
import { deepAssign, sampleID } from '@/utils'
import {
  AdvancedConfigDefaults,
  DnsConfigDefaults,
  GeneralConfigDefaults,
  TunConfigDefaults
} from '@/constant'

export const restoreProfile = (
  config: Record<string, any>,
  subID: string,
  NameIdMap: Record<string, string>,
  IdNameMap: Record<string, string>
) => {
  const profile: ProfileType = {
    // The same ID indicates that this profile was generated by this subscription
    id: subID,
    name: subID,
    generalConfig: GeneralConfigDefaults(),
    advancedConfig: AdvancedConfigDefaults(),
    dnsConfig: DnsConfigDefaults(),
    tunConfig: TunConfigDefaults(),
    proxyGroupsConfig: [],
    rulesConfig: []
  }

  const GroupNameIdMap: Record<string, string> = {}
  const GroupIdNameMap: Record<string, string> = {}

  config['proxy-groups'].forEach((group: any) => {
    const id = sampleID()
    GroupNameIdMap[group.name] = id
    GroupIdNameMap[id] = group.name
  })

  function isBuiltIn(proxy: string) {
    return ['DIRECT', 'REJECT'].includes(proxy)
  }

  config['proxy-groups'].forEach((group: any) => {
    const _group = {
      id: GroupNameIdMap[group.name],
      name: group.name,
      type: group.type,
      proxies: (group.proxies || [])
        .map((proxy: string) => ({
          id: GroupNameIdMap[proxy] || NameIdMap[proxy] || proxy,
          type: GroupNameIdMap[proxy] || isBuiltIn(proxy) ? 'Built-In' : subID,
          name: GroupNameIdMap[proxy]
            ? GroupIdNameMap[GroupNameIdMap[proxy]]
            : IdNameMap[NameIdMap[proxy]] || (isBuiltIn(proxy) && proxy)
        }))
        // The absence of a 'name' attribute indicates that this proxy has been excluded after processing by filters or plugins.
        .filter((v: any) => v.name),
      url: group.url ?? 'https://www.gstatic.com/generate_204',
      interval: group.interval ?? 300,
      strategy: group.strategy ?? 'consistent-hashing',
      use: (group.use || []).map((use: string) => {
        return GroupNameIdMap[use] || use
      }),
      tolerance: group.tolerance ?? 150,
      lazy: group.lazy ?? true,
      'disable-udp': group['disable-udp'] ?? false,
      filter: group.filter ?? '',
      'exclude-filter': group['exclude-filter'] ?? ''
    }

    profile.proxyGroupsConfig.push(_group)
  })

  function getRuleProxy(type: string) {
    return ['DIRECT', 'REJECT'].includes(type.toUpperCase())
      ? type.toUpperCase()
      : GroupNameIdMap[type] || IdNameMap[NameIdMap[type]]
  }

  Object.entries(config).forEach(([field, value]) => {
    if (Object.hasOwnProperty.call(profile.generalConfig, field)) {
      ;(profile.generalConfig as any)[field] = value
    } else if (Object.hasOwnProperty.call(profile.advancedConfig, field)) {
      ;(profile.advancedConfig as any)[field] = value
    } else if (field === 'dns') {
      profile.dnsConfig = deepAssign(profile.dnsConfig, value)
    } else if (field === 'tun') {
      profile.tunConfig = deepAssign(profile.tunConfig, value)
    } else if (field === 'rules') {
      config[field].forEach((rule: string, index: number) => {
        const [type, payload, proxy = '', noResolve] = rule.split(',')

        const _proxy = type === 'MATCH' ? getRuleProxy(payload) : getRuleProxy(proxy)

        // Skip invalid rules：proxy missing
        if (!_proxy) {
          return
        }

        profile.rulesConfig.push({
          id: index.toString(),
          type: type,
          payload: type === 'MATCH' ? '' : payload,
          proxy: _proxy,
          'no-resolve': !!noResolve
        })
      })
    }
  })

  return profile
}
