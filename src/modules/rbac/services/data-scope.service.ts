import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { DataScope } from '../enums/data-scope.enum';
import { UserCompany } from '../../organization/entities/user-company.entity';
import { UserBranch } from '../../organization/entities/user-branch.entity';
import { UserWarehouse } from '../../organization/entities/user-warehouse.entity';
import { MembershipStatus } from '../../organization/entities/membership-status.enum';

/**
 * Broadest-first ordering used only to pick a single "most permissive"
 * scope when a user's active roles grant different scopes for the same
 * resource (approved decision: union / most-permissive wins, never
 * "deny wins" and never silently the most restrictive). This ordering is
 * intentionally centralized here rather than scattered as ad hoc
 * comparisons — see Phase 06 spec §96, which requires any such precedence
 * to be documented per-resource rather than assumed universal. This is the
 * one documented, generic ordering Phase 06 establishes; a future resource
 * with different semantics can override it explicitly rather than being
 * forced through this list.
 */
const SCOPE_BREADTH: readonly DataScope[] = [
  DataScope.Own,
  DataScope.Account,
  DataScope.Team,
  DataScope.Branch,
  DataScope.Warehouse,
  DataScope.Company,
  DataScope.Organization,
  DataScope.All,
];

export interface ResolvedScope {
  scope: DataScope;
  scopeValue: string | null;
}

@Injectable()
export class DataScopeService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserCompany)
    private readonly userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(UserBranch)
    private readonly userBranchRepository: Repository<UserBranch>,
    @InjectRepository(UserWarehouse)
    private readonly userWarehouseRepository: Repository<UserWarehouse>,
  ) {}

  /**
   * Resolves the effective data-visibility scope a user has for a given
   * resource, across all of their ACTIVE roles. Returns null when no active
   * role grants any scope for the resource — callers must treat that as
   * "no access" (safe default), never as "unrestricted."
   *
   * When multiple roles grant different scopes for the same resource, the
   * broadest is returned (union/most-permissive, per the approved
   * architecture decision) — never an arbitrary or most-restrictive choice.
   * scopeValue is only meaningful when a future caller also needs a
   * specific target id; Phase 06 does not interpret it.
   */
  async resolveScope(
    userId: string,
    resource: string,
  ): Promise<ResolvedScope | null> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, role: { status: RoleStatus.Active } },
      relations: { role: { resourceScopes: true } },
    });

    let best: ResolvedScope | null = null;
    let bestBreadthIndex = -1;

    for (const userRole of userRoles) {
      for (const roleScope of userRole.role.resourceScopes ?? []) {
        if (roleScope.resource !== resource) {
          continue;
        }

        const breadthIndex = SCOPE_BREADTH.indexOf(roleScope.scope);
        if (breadthIndex > bestBreadthIndex) {
          bestBreadthIndex = breadthIndex;
          best = { scope: roleScope.scope, scopeValue: roleScope.scopeValue };
        }
      }
    }

    return best;
  }

  /**
   * Resolves a previously-computed COMPANY/BRANCH/WAREHOUSE scope into the
   * concrete set of IDs a user is actually allowed to see (Phase 08 §4,
   * §16-17 — the primary Phase 08/Phase 06-07 integration point flagged
   * since Phase 07's own documentation). ALL short-circuits to null
   * (caller must treat null as "no ID filtering needed / everything
   * authorized"), since resolving ALL against membership rows would be
   * both meaningless and an unnecessary query as membership data grows.
   * Any other scope value returns an empty array (§4 "safe default" — no
   * access, never unrestricted), since this method only knows about
   * organizational membership, not other scope kinds (OWN/ACCOUNT/TEAM).
   *
   * This is the one integration point Phase 08 adds to DataScopeService —
   * deliberately not a second resolution engine (Phase 08 §16 LOCKED).
   */
  async resolveAllowedOrganizationIds(
    userId: string,
    resolved: ResolvedScope,
  ): Promise<string[] | null> {
    if (resolved.scope === DataScope.All) {
      return null;
    }

    if (resolved.scope === DataScope.Company) {
      const memberships = await this.userCompanyRepository.find({
        where: { userId, status: MembershipStatus.Active },
      });
      return memberships.map((membership) => membership.companyId);
    }

    if (resolved.scope === DataScope.Branch) {
      const memberships = await this.userBranchRepository.find({
        where: { userId, status: MembershipStatus.Active },
      });
      return memberships.map((membership) => membership.branchId);
    }

    if (resolved.scope === DataScope.Warehouse) {
      const memberships = await this.userWarehouseRepository.find({
        where: { userId, status: MembershipStatus.Active },
      });
      return memberships.map((membership) => membership.warehouseId);
    }

    return [];
  }
}
