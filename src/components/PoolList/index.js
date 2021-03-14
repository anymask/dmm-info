import React, { useState, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { Flex, Text } from 'rebass'
import { ChevronUp, ChevronDown } from 'react-feather'

import { ButtonEmpty } from '../ButtonStyled'
import Link from '../Link'
import FavoriteStar from '../Icons/FavoriteStar'
import AddCircle from '../Icons/AddCircle'
import InfoHelper from '../InfoHelper'
import Loader from '../LocalLoader'
import { shortenAddress, formattedNum } from '../../utils'
import { getHealthFactor } from '../../utils/dmm'

const TableHeader = styled.div`
  display: grid;
  grid-gap: 1em;
  grid-template-columns: repeat(6, 1fr) repeat(2, 0.5fr);
  grid-template-areas: 'pool ratio liq vol';
  padding: 15px 36px 13px 26px;
  font-size: 12px;
  align-items: center;
  height: fit-content;
  position: relative;
  opacity: ${({ fade }) => (fade ? '0.6' : '1')};
  background-color: ${({ theme }) => theme.evenRow};
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`

const TableRow = styled.div`
  display: grid;
  grid-gap: 1em;
  grid-template-columns: repeat(6, 1fr) repeat(2, 0.5fr);
  grid-template-areas: 'pool ratio liq vol';
  padding: 15px 36px 13px 26px;
  font-size: 12px;
  align-items: flex-start;
  height: fit-content;
  position: relative;
  opacity: ${({ fade }) => (fade ? '0.6' : '1')};
  background-color: ${({ theme, oddRow }) => (oddRow ? theme.oddRow : theme.evenRow)};
  border: 1px solid transparent;

  &:hover {
    border: 1px solid #4a636f;
  }
`

const ClickableText = styled(Text)`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.text6};
  &:hover {
    cursor: pointer;
    opacity: 0.6;
  }
  user-select: none;
  text-transform: uppercase;
`

const DataText = styled(Flex)`
  color: ${({ theme }) => theme.text7};
  flex-direction: column;
`

const LoadMoreButtonContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: ${({ theme }) => theme.oddRow};
  font-size: 12px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
`

const getOneYearFL = (liquidity, feeOneDay) => {
  return parseFloat(liquidity) === 0 ? 0 : (parseFloat(feeOneDay) * 365 * 100) / parseFloat(liquidity)
}

const ListItem = ({ pool, oddRow }) => {
  const amp = pool.amp / 10000

  // Recommended pools are pools that have AMP = 1 or is registered by kyber DAO in a whitelist contract
  // TODO: Add recommended pool which is registered by kyber DAO  in a whitelist contract
  const isRecommended = amp === 1

  const percentToken0 =
    ((pool.vReserve0 / pool.reserve0) * 100) / (pool.vReserve0 / pool.reserve0 + pool.vReserve1 / pool.reserve1)
  const percentToken1 = 100 - percentToken0
  // Shorten address with 0x + 3 characters at start and end
  const shortenPoolAddress = shortenAddress(pool.id, 3)

  const oneYearFL = getOneYearFL(pool.reserveUSD, pool.feeUSD).toFixed(2)

  return (
    <TableRow oddRow={oddRow}>
      {isRecommended && (
        <div style={{ position: 'absolute' }}>
          <FavoriteStar />
        </div>
      )}
      <DataText grid-area="pool">{shortenPoolAddress}</DataText>
      <DataText grid-area="ratio">
        <div>{`• ${percentToken0.toPrecision(2) ?? '.'}% ${pool.token0.symbol}`}</div>
        <div>{`• ${percentToken1.toPrecision(2) ?? '.'}% ${pool.token1.symbol}`}</div>
      </DataText>
      <DataText grid-area="liq">{formattedNum(pool.reserveUSD, true)}</DataText>
      <DataText grid-area="vol">{formattedNum(pool.volumeUSD, true)}</DataText>
      <DataText>{formattedNum(pool.feeUSD, true)}</DataText>
      <DataText>{formattedNum(amp.toPrecision(5))}</DataText>
      <DataText>{`${oneYearFL}%`}</DataText>
      <DataText style={{ alignItems: 'flex-start' }}>
        {
          <Link
            href={`${process.env.REACT_APP_DMM_SWAP_URL}add/${pool.token0.id}/${pool.token1.id}/${pool.id}`}
            target="_blank"
          >
            <ButtonEmpty padding="0" width="fit-content" style={{ padding: 0 }}>
              <AddCircle />
            </ButtonEmpty>
          </Link>
        }
      </DataText>
    </TableRow>
  )
}

const SORT_FIELD = {
  NONE: -1,
  LIQ: 0,
  VOL: 1,
  FEES: 2,
  ONE_YEAR_FL: 3,
}

const PoolList = ({ pools, maxItems = 10 }) => {
  // pagination
  const [page, setPage] = useState(1)
  const [maxPage, setMaxPage] = useState(1)
  const ITEMS_PER_PAGE = maxItems

  // sorting
  const [sortDirection, setSortDirection] = useState(true)
  const [sortedColumn, setSortedColumn] = useState(SORT_FIELD.NONE)

  const sortList = (poolA, poolB) => {
    if (sortedColumn === SORT_FIELD.NONE) {
      if (!poolA) {
        return 1
      }

      if (!poolB) {
        return -1
      }

      // Pool with AMP = 1 will be on top
      // AMP from contract is 10000 (real value is 1)å
      if (parseFloat(poolA.amp) === 10000) {
        return -1
      }

      if (parseFloat(poolB.amp) === 10000) {
        return 1
      }

      const poolAHealthFactor = getHealthFactor(poolA)
      const poolBHealthFactor = getHealthFactor(poolB)

      // Pool with better health factor will be prioritized higher
      if (poolAHealthFactor > poolBHealthFactor) {
        return -1
      }

      if (poolAHealthFactor < poolBHealthFactor) {
        return 1
      }

      return 0
    }

    switch (sortedColumn) {
      case SORT_FIELD.LIQ:
        return parseFloat(poolA.reserveUSD) > parseFloat(poolB.reserveUSD)
          ? (sortDirection ? -1 : 1) * 1
          : (sortDirection ? -1 : 1) * -1
      case SORT_FIELD.VOL:
        return parseFloat(poolA.volumeUSD) > parseFloat(poolB.volumeUSD)
          ? (sortDirection ? -1 : 1) * 1
          : (sortDirection ? -1 : 1) * -1
      case SORT_FIELD.FEES:
        return parseFloat(poolA.feeUSD) > parseFloat(poolB.feeUSD)
          ? (sortDirection ? -1 : 1) * 1
          : (sortDirection ? -1 : 1) * -1
      case SORT_FIELD.ONE_YEAR_FL:
        const oneYearFLPoolA = getOneYearFL(poolA.reserveUSD, poolA.feeUSD)
        const oneYearFLPoolB = getOneYearFL(poolB.reserveUSD, poolB.feeUSD)

        return oneYearFLPoolA > oneYearFLPoolB ? (sortDirection ? -1 : 1) * 1 : (sortDirection ? -1 : 1) * -1
      default:
        break
    }

    return 0
  }

  const poolsList =
    pools &&
    Object.keys(pools)
      .sort((addressA, addressB) => {
        const poolA = pools[addressA]
        const poolB = pools[addressB]
        return sortList(poolA, poolB)
      })
      .slice(0, page * ITEMS_PER_PAGE)
      .map((poolAddress) => {
        return poolAddress && pools[poolAddress]
      })

  useEffect(() => {
    setMaxPage(1) // edit this to do modular
    setPage(1)
  }, [pools])

  useEffect(() => {
    if (pools) {
      let extraPages = 1
      if (Object.keys(pools).length % ITEMS_PER_PAGE === 0) {
        extraPages = 0
      }
      setMaxPage(Math.floor(Object.keys(pools).length / ITEMS_PER_PAGE) + extraPages)
    }
  }, [ITEMS_PER_PAGE, pools])

  return (
    <div>
      <TableHeader>
        <Flex alignItems="center" justifyContent="flexStart">
          <ClickableText>Pool</ClickableText>
        </Flex>
        <Flex alignItems="center" justifyContent="flexEnd">
          <ClickableText>Ratio</ClickableText>
          <InfoHelper text={'Based on 24hr volume annualized'} />
        </Flex>
        <Flex alignItems="center" justifyContent="flexEnd">
          <ClickableText
            onClick={() => {
              setSortedColumn(SORT_FIELD.LIQ)
              setSortDirection(sortedColumn !== SORT_FIELD.LIQ ? true : !sortDirection)
            }}
          >
            Liquidity
            {sortedColumn === SORT_FIELD.LIQ ? (
              !sortDirection ? (
                <ChevronUp size="14" style={{ marginLeft: '2px' }} />
              ) : (
                <ChevronDown size="14" style={{ marginLeft: '2px' }} />
              )
            ) : (
              ''
            )}
          </ClickableText>
        </Flex>
        <Flex alignItems="center">
          <ClickableText
            onClick={() => {
              setSortedColumn(SORT_FIELD.VOL)
              setSortDirection(sortedColumn !== SORT_FIELD.VOL ? true : !sortDirection)
            }}
          >
            Volume
            {sortedColumn === SORT_FIELD.VOL ? (
              !sortDirection ? (
                <ChevronUp size="14" style={{ marginLeft: '2px' }} />
              ) : (
                <ChevronDown size="14" style={{ marginLeft: '2px' }} />
              )
            ) : (
              ''
            )}
          </ClickableText>
        </Flex>

        <Flex alignItems="center" justifyContent="flexEnd">
          <ClickableText
            onClick={() => {
              setSortedColumn(SORT_FIELD.FEES)
              setSortDirection(sortedColumn !== SORT_FIELD.FEES ? true : !sortDirection)
            }}
          >
            Fee (24h)
            {sortedColumn === SORT_FIELD.FEES ? (
              !sortDirection ? (
                <ChevronUp size="14" style={{ marginLeft: '2px' }} />
              ) : (
                <ChevronDown size="14" style={{ marginLeft: '2px' }} />
              )
            ) : (
              ''
            )}
          </ClickableText>
        </Flex>

        <Flex alignItems="center" justifyContent="flexEnd">
          <ClickableText>AMP</ClickableText>
          <InfoHelper text={'Based on 24hr volume annualized'} />
        </Flex>

        <Flex alignItems="center" justifyContent="flexEnd">
          <ClickableText
            onClick={() => {
              setSortedColumn(SORT_FIELD.ONE_YEAR_FL)
              setSortDirection(sortedColumn !== SORT_FIELD.ONE_YEAR_FL ? true : !sortDirection)
            }}
          >
            1y F/L
            {sortedColumn === SORT_FIELD.ONE_YEAR_FL ? (
              !sortDirection ? (
                <ChevronUp size="14" style={{ marginLeft: '2px' }} />
              ) : (
                <ChevronDown size="14" style={{ marginLeft: '2px' }} />
              )
            ) : (
              ''
            )}
          </ClickableText>
        </Flex>

        <Flex alignItems="center" justifyContent="flexEnd" />
      </TableHeader>
      {!poolsList ? (
        <Loader />
      ) : (
        poolsList.map((pool, index) => {
          if (pool) {
            return <ListItem key={pool.address} pool={pool} oddRow={(index + 1) % 2 !== 0} />
          }

          return null
        })
      )}
      <LoadMoreButtonContainer>
        <ButtonEmpty
          onClick={() => {
            setPage(page === maxPage ? page : page + 1)
          }}
          disabled={page >= maxPage}
          style={{ padding: '18px' }}
        >
          Show more pools
        </ButtonEmpty>
      </LoadMoreButtonContainer>
    </div>
  )
}

export default PoolList
